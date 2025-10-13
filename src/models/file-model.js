const mongoose = require("mongoose");

const TADIGSummarySchema = new mongoose.Schema({
  TADIGCode: String,
  MCC: { type: String, index: true },
  MNC: { type: String, index: true },
  NetworkType: String,
  VPMNHPMNList: String,
}, {_id: false});


const NumberRangeSchema = new mongoose.Schema({
  CC: String,
  NDC: String,
  SN_RangeStart: String,
  SN_RangeStop: String,
  NetworkOwner: String,
}, {_id: false});

const NwNodeSchema = new mongoose.Schema({
  NwElementType: String,
  GTAddressInfo: {
    CC: String,
    NDC: String,
    SN_RangeStart: String,
    SN_RangeStop: String,
  },
  IPAddressInfo: {
    IPAddress: String,
    IPAddressRange: String,
  },
  VendorInfo: String,
  UTCTimeOffset: String,
}, {_id: false});


const SCCPGatewaySchema = new mongoose.Schema({
  carrierName: String,
  connectivityInfo: String,
  dpcList: [{ SCSignature: String, SCType: String, DPC: String }],
}, {_id: false});


const InterPMNBackboneIPSchema = new mongoose.Schema({
  ipAddressRange: { type: String, index: true },
  networkOwner: String,
}, {_id: false});


const GRXIPXRoutingSchema = new mongoose.Schema({
  grxProvider: String,
  interPMNBackboneIPList: [InterPMNBackboneIPSchema],
}, {_id: false});

const DNSSchema = new mongoose.Schema({
  ipAddress: { type: String, index: true }, 
  dnsName: { type: String },                 
  priority: { type: String },             
  networkOwner: { type: String }             
}, { _id: false });


const ASNSchema = new mongoose.Schema({
  asNumber: String,
  operator: String,
}, {_id: false});

const APNCredentialSchema = new mongoose.Schema({
  APN: String,
  Username: String,
  Password: String,
}, {_id: false});

const APNWEBSchema = new mongoose.Schema({
  credential: APNCredentialSchema,
  apnTypes: [String],
  pduSessionTypes: [String],
  pdnTypes: [String],
  pdpTypes: [String],
  primaryDNS: String,
  secondaryDNS: String,
}, {_id: false});

const APNWAPSchema = new mongoose.Schema({
  credential: APNCredentialSchema,
  apnTypes: [String],
  gatewayIPAddress: String,
  serverURL: String,
  ports: [String],
}, {_id: false});

const APNMMSSchema = new mongoose.Schema({
  credential: APNCredentialSchema,
  gatewayIPAddress: String,
  messagingServerURL: String,
}, {_id: false});

const PacketDataServiceInfoSchema = new mongoose.Schema({
  apnOperatorIdentifiers: [String],
  testingAPNs: {
    web: [APNWEBSchema],
    wap: [APNWAPSchema],
    mms: [APNMMSSchema],
  },
  gtpVersions: {
    sgsn: [String],
    ggsn: [String],
  },
  qosProfiles: [{
    profileName: String,
    trafficClass: String,
    arp: String,
  }],
}, {_id: false});


const FileDataSchema = new mongoose.Schema({
  fileName: { type: String, required: true, index: true },
  fileCreationTimestamp: Date,
  senderTADIG: String,
  organisationName: { type: String, index: true },
  countryInitials: { type: String, index: true },
  countryName: {
    type: String,
    default: null,
    index: true
  },
  countryFlagUrl: {
    type: String,
    default: null
  },
  organizationLogo: {
    type: String,
    default: null
  },
  E214: {
    CC: {
      type: String,
    },
    NC: {
      type: String,
    }
  },
  tadigSummaryList: [TADIGSummarySchema],
  msisdnNumberRanges: [NumberRangeSchema],
  gtNumberRanges: [NumberRangeSchema],
  msrnNumberRanges: [NumberRangeSchema],
  npNumberRanges: [NumberRangeSchema],
  nwNodes: [NwNodeSchema],
  internationalSCCPGateway: [SCCPGatewaySchema],
  domesticSCCPGateway: mongoose.Schema.Types.Mixed,
  grxIpxRouting: GRXIPXRoutingSchema,
  dnsInfo: {
    authoritative: [DNSSchema],  
    local: [DNSSchema]         
  },
  asnInfo: [ASNSchema],
  packetDataServiceInfo: PacketDataServiceInfoSchema,
  supportedTechnologies: mongoose.Schema.Types.Mixed,
});

module.exports = mongoose.model("FileData", FileDataSchema);