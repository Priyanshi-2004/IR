const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { PORT } = require('./config/server-config')
const {connectToDB} = require('./config/db-config');
const userRoutes = require('./routes/user-routes');
const fileRoutes = require('./routes/file-routes');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/user/auth', userRoutes);
app.use("/api/file", fileRoutes);

const MISP_URL = process.env.MISP_URL;
const MISP_KEY = process.env.MISP_KEY;
// console.log("MISP_KEY:", MISP_KEY);
// Shared axios config
const axiosConfig = {
  headers: {
    Authorization: MISP_KEY,
    Accept: 'application/json'
  },
  timeout: 15000
};
// console.log("Misp_key:", MISP_KEY);

// -------------------- EVENTS --------------------

// List events
app.get('/api/events', async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);
  try {
    const response = await axios.post(
      `${MISP_URL}/events/restSearch`,
      { returnFormat: 'json', page, limit },
      axiosConfig
    );

    const events = response.data.response ?? response.data;
    res.json(events);
  } catch (error) {
    console.error('❌ /api/events failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Single event
app.get('/api/events/:id', async (req, res) => {
  try {
    const response = await axios.get(`${MISP_URL}/events/view/${req.params.id}`, axiosConfig);
    res.json(response.data.Event ?? response.data);
  } catch (error) {
    console.error(`❌ /api/events/${req.params.id} failed:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Event attributes
app.get('/api/events/:id/attributes', async (req, res) => {
  try {
    const response = await axios.get(`${MISP_URL}/events/view/${req.params.id}.json`, axiosConfig);
    const event = response.data.Event ?? response.data;
    res.json(event.Attribute || []);
  } catch (error) {
    console.error(`❌ /api/events/${req.params.id}/attributes failed:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// -------------------- GRAPHS --------------------

// Normalized graph (nodes + edges)
app.get('/api/events/:id/graph-json', async (req, res) => {
  try {
    const response = await axios.get(
      `${MISP_URL}/events/updateGraph/${req.params.id}/event.json`,
      axiosConfig
    );

    const raw = response.data;

    const nodes = (raw.nodes || raw.vertices || []).map(n => ({
      id: n.id || n.uuid,
      label: n.value || n.name || n.id,
      type: n.type || 'unknown'
    }));

    const edges = (raw.edges || raw.links || []).map(e => ({
      source: e.source,
      target: e.target,
      relation: e.relation || e.type || 'linked'
    }));

    res.json({ nodes, edges });
  } catch (error) {
    console.error(`❌ /api/events/${req.params.id}/graph-json failed:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Raw full graph
app.get('/api/events/:id/full-graph', async (req, res) => {
  try {
    const response = await axios.get(
      `${MISP_URL}/events/updateGraph/${req.params.id}/event.json`,
      axiosConfig
    );
    res.json(response.data);
  } catch (error) {
    console.error(`❌ /api/events/${req.params.id}/full-graph failed:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// Correlation graph (tag-based)
app.get('/api/correlation-graph', async (req, res) => {
  const { tag = 'gsma-motif:*' } = req.query;

  try {
    const response = await axios.post(
      `${MISP_URL}/events/restSearch`,
      { returnFormat: 'json', tags: [tag] },
      axiosConfig
    );

    const events = response.data.response ?? [];
    const nodes = [];
    const edges = [];
    const seen = new Set();

    for (const event of events) {
      const e = event.Event;
      if (!seen.has(e.uuid)) {
        nodes.push({ id: e.uuid, label: e.info, type: 'event' });
        seen.add(e.uuid);
      }

      for (const attr of e.Attribute || []) {
        if (!seen.has(attr.uuid)) {
          nodes.push({ id: attr.uuid, label: attr.value, type: 'attribute' });
          seen.add(attr.uuid);
        }
        edges.push({ source: attr.uuid, target: e.uuid, relation: 'correlation' });
      }
    }

    res.json({ nodes, edges });
  } catch (error) {
    console.error('❌ /api/correlation-graph failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// -------------------- GALAXIES & REPORTS --------------------

app.get('/api/galaxies/index.json', async (req, res) => {
  try {
    const galaxiesRes = await axios.get(`${MISP_URL}/galaxies/index.json`, axiosConfig);
    const galaxies = galaxiesRes.data;

    const enriched = await Promise.all(
      galaxies.map(async g => {
        const galaxyId = g.Galaxy?.id;
        if (!galaxyId) return { ...g, clusters: [] };

        try {
          const clustersRes = await axios.get(
            `${MISP_URL}/galaxy_clusters/index/${galaxyId}.json`,
            axiosConfig
          );
          return { ...g, clusters: clustersRes.data };
        } catch (err) {
          console.error(`❌ Failed clusters for galaxy ${galaxyId}:`, err.response?.data || err.message);
          return { ...g, clusters: [] };
        }
      })
    );

    res.json({ count: enriched.length, data: enriched });
  } catch (err) {
    console.error("❌ /api/galaxies/index.json failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --------------------
// 2. Get clusters for one galaxy
// --------------------
app.get('/api/galaxy-clusters/:galaxyId', async (req, res) => {
  try {
    const { galaxyId } = req.params;
    const response = await axios.get(
      `${MISP_URL}/galaxy_clusters/index/${galaxyId}.json`,
      axiosConfig
    );
    res.json(response.data);
  } catch (error) {
    console.error(`❌ /api/galaxy-clusters/${req.params.galaxyId} failed:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});


// Reports
app.get('/api/events/:id/reports', async (req, res) => {
  try {
    const response = await axios.get(`${MISP_URL}/eventReports/index/${req.params.id}.json`, axiosConfig);
    res.json(response.data);
  } catch (error) {
    console.error(`❌ /api/events/${req.params.id}/reports failed:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

app.get('/api/reports/:reportId', async (req, res) => {
  try {
    const response = await axios.get(`${MISP_URL}/eventReports/view/${req.params.reportId}.json`, axiosConfig);
    res.json(response.data);
  } catch (error) {
    console.error(`❌ /api/reports/${req.params.reportId} failed:`, error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// ----------------------Galaxy MAtrix ----------------------

// Get Galaxy Matrix (ATT&CK-style matrix for a given galaxy_id)
app.get('/api/galaxy/:galaxyId/matrix', async (req, res) => {
  const { galaxyId } = req.params;

  try {
    const response = await axios.get(
      `${MISP_URL}/galaxy_clusters/viewMatrix/${galaxyId}.json`,
      {
        headers: {
          Authorization: MISP_KEY,
          Accept: 'application/json',
        },
      }
    );

    const data = response.data;

    // Extract the matrix if available
    const matrix = data.GalaxyCluster?.matrix || {};

    res.json({
      galaxyId,
      matrix
    });

  } catch (error) {
    console.error(`❌ Failed to fetch Galaxy Matrix for ${galaxyId}`, error.message);

    if (error.response) {
      res.status(error.response.status).json({
        error: `MISP returned ${error.response.status}`,
        details: error.response.data
      });
    } else {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
});

// -----------Event Timeline-------------------------------
app.get('/api/events/:id/timeline', async (req, res) => {
  const { id } = req.params;

  try {
    const response = await axios.get(`${MISP_URL}/events/view/${id}.json`, {
       
        headers: {
          Authorization: MISP_KEY,
          Accept: 'application/json',
        },
    });

    const event = response.data.Event ?? response.data;
    const timeline = [];

    // Attributes
    for (const attr of event.Attribute || []) {
      timeline.push({
        id: attr.id,
        type: 'attribute',
        value: attr.value,
        category: attr.category,
        timestamp: attr.timestamp,
        first_seen: attr.first_seen,
        last_seen: attr.last_seen,
      });
    }

    // Objects
    for (const obj of event.Object || []) {
      timeline.push({
        id: obj.id,
        type: 'object',
        name: obj.name,
        timestamp: obj.timestamp,
        first_seen: obj.first_seen,
        last_seen: obj.last_seen,
      });
    }

    // Sort by timestamp
    const sortedTimeline = timeline.sort(
      (a, b) => (parseInt(a.timestamp || 0) - parseInt(b.timestamp || 0))
    );

    res.json({
      event_id: id,
      count: sortedTimeline.length,
      timeline: sortedTimeline,
    });
  } catch (error) {
    console.error(`❌ Failed to fetch timeline for event ${id}`, error.message);
    if (error.response) {
      res
        .status(error.response.status)
        .json({ error: error.response.statusText, details: error.response.data });
    } else {
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }
});



// -------------------- ATTRIBUTES --------------------

app.post('/api/attributes/search', async (req, res) => {
  try {
    const response = await axios.post(`${MISP_URL}/attributes/restSearch.json`, req.body, axiosConfig);
    res.json(response.data);
  } catch (error) {
    console.error('❌ /api/attributes/search failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});

// -------------------- TEMPLATES --------------------

app.get('/api/templates', async (req, res) => {
  const page = parseInt(req.query.page || '1', 10);
  const limit = parseInt(req.query.limit || '10', 10);

  try {
    const response = await axios.get(`${MISP_URL}/events/getObjectTemplate/templates.json`, axiosConfig);
    const templates = Array.isArray(response.data) ? response.data : Object.values(response.data);

    const start = (page - 1) * limit;
    const paginated = templates.slice(start, start + limit);

    res.json({
      page,
      limit,
      total: templates.length,
      totalPages: Math.ceil(templates.length / limit),
      data: paginated
    });
  } catch (error) {
    console.error('❌ /api/templates failed:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: error.message });
  }
});


const setupAndStartServer = () => {
    app.listen(PORT, async () => {
        console.log("Server running on PORT:", PORT);
        await connectToDB();
    })
}

setupAndStartServer();
