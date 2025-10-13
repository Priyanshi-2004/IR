const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload");
const dataController = require("../controllers/file-controller");

router.post("/upload", upload.single("file"), dataController.uploadXML);
router.get("/data", dataController.getAllData);
router.get("/data/:id", dataController.getDataById);


module.exports = router;
