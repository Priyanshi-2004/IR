const fs = require("fs");
const xml2js = require("xml2js");
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const mongoose = require("mongoose");
const FileData = require("../models/file-model");
const countries = require("i18n-iso-countries");
countries.registerLocale(require("i18n-iso-countries/langs/en.json"));

// parse XML → JSON
const parseXML = async (xml) => {
    return await xml2js.parseStringPromise(xml, {
        explicitArray: true,
        mergeAttrs: true,
        explicitRoot: false,
        trim: true
    });
};

// Ensure a value is always an array
const normalizeArray = (val) => {
    if (!val) return [];
    return Array.isArray(val) ? val : [val];
};

exports.uploadXML = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: "Bad Request",
                message: "No file was uploaded. Please attach an XML file to your request."
            });
        }
        const xml = fs.readFileSync(req.file.path, "utf8");
        const json = await parseXML(xml);

        const header = json?.RAEXIR21FileHeader?.[0] || {};
        const org = json?.OrganisationInfo?.[0] || {};

        const primaryTADIGCode = org?.TADIGSummaryList?.[0]?.TADIGSummaryItem?.[0]?.TADIGCode?.[0] ||
            org?.NetworkList?.[0]?.Network?.[0]?.TADIGCode?.[0];;
        const organisationName = org?.OrganisationName?.[0];
        const existingFile = await FileData.findOne({
            "tadigSummaryList.TADIGCode": primaryTADIGCode

        });

        if (existingFile) {
            await unlinkAsync(req.file.path);
            return res.status(409).json({
                error: "Duplicate File",
                message: `This file version (TADIG: ${primaryTADIGCode}) has already been uploaded.`,
                fileId: existingFile._id
            });
        }

        let fileName = [primaryTADIGCode, organisationName].filter(Boolean).join(' ');
        if (!fileName) {
            fileName = req.file.originalname.replace('.xml', '');
        }
        const countryInitials = org?.CountryInitials?.[0]?.toUpperCase();
        let countryName = null;
        let countryFlagUrl = null;
        if (countryInitials) {
            let alpha2Code = countries.alpha3ToAlpha2(countryInitials);
            if (alpha2Code && countries.getName(alpha2Code, "en")) {
                countryName = countries.getName(alpha2Code, "en");
                countryFlagUrl = `https://cdn.jsdelivr.net/npm/country-flag-icons/3x2/${alpha2Code}.svg`
            }
        }
        const network = org?.NetworkList?.[0]?.Network?.[0] || {};
        const networkData = network?.NetworkData?.[0] || {};
        const packetInfo = networkData?.PacketDataServiceInfoSection?.[0]?.PacketDataServiceInfo?.[0] || {};
        const routingInfo = networkData?.RoutingInfoSection?.[0]?.RoutingInfo?.[0] || {};
        const numberingPlan = routingInfo?.CCITT_E164_NumberSeries?.[0] || {};
        const networkElementsInfo = networkData?.NetworkElementsInfoSection?.[0]?.NetworkElementsInfo?.[0] || {};
        const grxIpxInfo = networkData?.GRXIPXRoutingForDataRoamingSection?.[0]?.GRXIPXRoutingForDataRoaming?.[0] || {};
        const rawE214 = routingInfo?.CCITT_E214_MGT?.[0] || {};

        const E214 = {
            CC: rawE214.MGT_CC?.[0] || null,
            NC: rawE214.MGT_NC?.[0] || null,
        };
        let tadigSummaryList = [];
        if (org?.TADIGSummaryList?.[0]?.TADIGSummaryItem) {
            tadigSummaryList = normalizeArray(org?.TADIGSummaryList?.[0]?.TADIGSummaryItem).map(item => ({
                TADIGCode: item.TADIGCode?.[0],
                MCC: item.NetworkProperties?.[0]?.MCC?.[0],
                MNC: item.NetworkProperties?.[0]?.MNC?.[0],
                NetworkType: item.NetworkProperties?.[0]?.NetworkType?.[0],
                VPMNHPMNList: normalizeArray(item.NetworkProperties?.[0]?.VPMNHPMNList?.[0]?.VPMNHPMN).join(', '),
            }));
        }
        else if (org?.NetworkList?.[0]?.Network) {
            tadigSummaryList = normalizeArray(org?.NetworkList?.[0]?.Network).map(network => ({
                TADIGCode: network.TADIGCode?.[0],
                MCC: network.NetworkData?.[0]?.RoutingInfoSection?.[0]?.RoutingInfo?.[0]?.CCITT_E212_NumberSeries?.[0]?.MCC?.[0],
                MNC: network.NetworkData?.[0]?.RoutingInfoSection?.[0]?.RoutingInfo?.[0]?.CCITT_E212_NumberSeries?.[0]?.MNC?.[0],
                NetworkType: network.NetworkType?.[0],
                NetworkName: network.NetworkName?.[0],
            }));
        }

        const msisdnNumberRanges = normalizeArray(numberingPlan?.MSISDN_NumberRanges?.[0]?.RangeData).map(range => ({
            CC: range.NumberRange?.[0]?.CC?.[0],
            NDC: range.NumberRange?.[0]?.NDC?.[0],
            SN_RangeStart: range.NumberRange?.[0]?.SN_Range?.[0]?.SN_RangeStart?.[0],
            SN_RangeStop: range.NumberRange?.[0]?.SN_Range?.[0]?.SN_RangeStop?.[0],
            NetworkOwner: range.NetworkOwner?.[0],
        }));

        const gtNumberRanges = normalizeArray(numberingPlan?.GT_NumberRanges?.[0]?.RangeData).map(range => ({
            CC: range.NumberRange?.[0]?.CC?.[0],
            NDC: range.NumberRange?.[0]?.NDC?.[0],
            SN_RangeStart: range.NumberRange?.[0]?.SN_Range?.[0]?.SN_RangeStart?.[0],
            SN_RangeStop: range.NumberRange?.[0]?.SN_Range?.[0]?.SN_RangeStop?.[0],
            NetworkOwner: range.NetworkOwner?.[0],
        }));

        const msrnNumberRanges = normalizeArray(numberingPlan?.MSRN_NumberRanges?.[0]?.RangeData).map(range => ({
            CC: range.NumberRange?.[0]?.CC?.[0],
            NDC: range.NumberRange?.[0]?.NDC?.[0],
            SN_RangeStart: range.NumberRange?.[0]?.SN_Range?.[0]?.SN_RangeStart?.[0],
            SN_RangeStop: range.NumberRange?.[0]?.SN_Range?.[0]?.SN_RangeStop?.[0],
        }));

        const npNumberRanges = normalizeArray(routingInfo?.NP_E164NumberRangesList?.[0]?.NP_E164NumberRange).map(range => ({
            CC: range.CC?.[0],
            NDC: range.NDC?.[0],
            SN_RangeStart: range.SN_Range?.[0]?.SN_RangeStart?.[0],
            SN_RangeStop: range.SN_Range?.[0]?.SN_RangeStop?.[0],
        }));

        const nwNodes = normalizeArray(networkElementsInfo?.NwNodeList?.[0]?.NwNode).map(node => ({
            NwElementType: node.NwElementType?.[0],
            GTAddressInfo: {
                CC: node.GTAddressInfo?.[0]?.CC?.[0],
                NDC: node.GTAddressInfo?.[0]?.NDC?.[0],
                SN_RangeStart: node.GTAddressInfo?.[0]?.SN_Range?.[0]?.SN_RangeStart?.[0],
                SN_RangeStop: node.GTAddressInfo?.[0]?.SN_Range?.[0]?.SN_RangeStop?.[0],
            },
            IPAddressInfo: {
                IPAddress: node.IPAddressInfo?.[0]?.IPAddress?.[0],
                IPAddressRange: node.IPAddressInfo?.[0]?.IPAddressRange?.[0],
            },
            VendorInfo: node.VendorInfo?.[0],
            UTCTimeOffset: node.UTCTimeOffset?.[0],
        }));

        const internationalSCCPGateway = normalizeArray(
            networkData?.InternationalSCCPGatewaySection?.[0]?.InternationalSCCPGatewayInfo?.[0]?.InternationalSCCPCarrierList?.[0]?.SCCPCarrierItem
        ).map(carrier => ({
            carrierName: carrier.SCCPCarrierName?.[0],
            connectivityInfo: carrier.SCCPConnectivityInformation?.[0],
            dpcList: normalizeArray(carrier.DPCList?.[0]?.DPCItem).map(dpc => ({
                SCSignature: dpc.SCSignature?.[0],
                SCType: dpc.SCType?.[0],
                DPC: dpc.DPC?.[0],
            }))
        }));

        const grxIpxRouting = {
            effectiveDateOfChange: grxIpxInfo?.EffectiveDateOfChange?.[0],
            grxProvider: normalizeArray(grxIpxInfo?.GRXIPXProvidersList?.[0]?.GRXIPXProviderItem)?.[0]?.ProviderName?.[0],
            interPMNBackboneIPList: normalizeArray(grxIpxInfo?.InterPMNBackboneIPList?.[0]?.IPAddressOrRange).map(item => ({
                ipAddressRange: item.IPAddressRange?.[0] ? item.IPAddressRange?.[0] : item.IPAddress?.[0],
                networkOwner: item.NetworkOwner?.[0],
            })),
        };

       let asnInfo = [];

// Case 1: Standard structure (GRXIPXRoutingForDataRoamingSection)
if (grxIpxInfo?.ASNsList?.[0]?.ASNItem) {
    asnInfo = normalizeArray(grxIpxInfo?.ASNsList?.[0]?.ASNItem).map(item => ({
        asNumber: item.ASN?.[0],
        operator: item.NetworkOwner?.[0],
    }));
}

// Case 2: Simpler structure (IPRoaming_IW_InfoSection → ASNsList → ASN)
else if (networkData?.IPRoaming_IW_InfoSection?.[0]?.IPRoaming_IW_Info_General?.[0]?.ASNsList?.[0]?.ASN) {
    asnInfo = normalizeArray(
        networkData.IPRoaming_IW_InfoSection[0].IPRoaming_IW_Info_General[0].ASNsList[0].ASN
    ).map(asn => ({
        asNumber: asn,
        operator: null, // optional — no operator info in this format
    }));
}

        const authoritativeDNS = normalizeArray(grxIpxInfo?.PMNAuthoritativeDNSIPList?.[0]?.DNSitem)
            .map(item => ({
                ipAddress: item.IPAddress?.[0] || null,
                dnsName: item.DNSname?.[0] || null,
                priority: item.Priority?.[0] || null,
                networkOwner: item.NetworkOwner?.[0] || null,
            }));
        const localDNS = normalizeArray(grxIpxInfo?.PMNLocalDNSIPList?.[0]?.DNSitem)
            .map(item => ({
                ipAddress: item.IPAddress?.[0] || null,
                dnsName: item.DNSname?.[0] || null,
                priority: item.Priority?.[0] || null,
                networkOwner: item.NetworkOwner?.[0] || null,
            }));
        const dnsInfo = {
            authoritative: authoritativeDNS,
            local: localDNS
        };
        const packetDataServiceInfo = {
            apnOperatorIdentifiers: normalizeArray(packetInfo.APNOperatorIdentifierList?.[0]?.APNOperatorIdentifierItem).map(
                item => item.APNOperatorIdentifier?.[0]
            ),
            testingAPNs: {
                web: normalizeArray(packetInfo.TestingAPNs?.[0]?.APN_WEBList?.[0]?.APN_WEB).map(web => ({
                    credential: {
                        APN: web.APN_Credential?.[0]?.APN?.[0]
                    },
                    apnTypes: normalizeArray(web.APNTypeList?.[0]?.APNType),
                    pduSessionTypes: normalizeArray(web.RequiredPduSessionTypeList?.[0]?.RequiredPduSessionType),
                    pdnTypes: normalizeArray(web.RequiredPdnTypeList?.[0]?.RequiredPdnType),
                    pdpTypes: normalizeArray(web.RequiredPdpTypeList?.[0]?.RequiredPdpType),
                    primaryDNS: web.ISP_DNS_IP_AddressPrimary?.[0],
                    secondaryDNS: web.ISP_DNS_IP_AddressSecondary?.[0],
                })),
                wap: normalizeArray(packetInfo.TestingAPNs?.[0]?.APN_WAPList?.[0]?.APN_WAP).map(wap => ({
                    credential: {
                        APN: wap.APN_Credential?.[0]?.APN?.[0]
                    },
                    apnTypes: normalizeArray(wap.APNTypeList?.[0]?.APNType),
                    gatewayIPAddress: wap.WAP_Gateway_IP_Address?.[0],
                    serverURL: wap.WAP_Server_URL?.[0],
                    ports: normalizeArray(wap.WAP1_PortList?.[0]?.WAP_Port),
                })),
                mms: normalizeArray(packetInfo.TestingAPNs?.[0]?.APN_MMSList?.[0]?.APN_MMS).map(mms => ({
                    credential: {
                        APN: mms.APN_Credential?.[0]?.APN?.[0],
                        Username: mms.APN_Credential?.[0]?.Username?.[0],
                        Password: mms.APN_Credential?.[0]?.Password?.[0],
                    },
                    gatewayIPAddress: mms.MMS_Gateway_IP_Address?.[0],
                    messagingServerURL: mms.Messaging_Server_URL?.[0],
                })),
            },
            gtpVersions: {
                sgsn: normalizeArray(packetInfo.GTPVersionInfo?.[0]?.SGSN_GTPVersionList?.[0]?.SGSN_GTPVersion),
                ggsn: normalizeArray(packetInfo.GTPVersionInfo?.[0]?.GGSN_GTPVersionList?.[0]?.GGSN_GTPVersion),
            },
            qosProfiles: normalizeArray(packetInfo.QOSProfile2G3GList?.[0]?.QOSProfile2G3GItem).map(qos => ({
                profileName: qos.ProfileName2G3G?.[0],
                trafficClass: qos.TrafficClassList?.[0]?.TrafficClass?.[0],
                arp: qos.ARP2G3GList?.[0]?.ARP2G3G?.[0],
            })),
        };

        const newFile = new FileData({
            fileName,
            fileCreationTimestamp: header?.FileCreationTimestamp?.[0],
            senderTADIG: header?.SenderTADIG?.[0],
            organisationName: org?.OrganisationName?.[0],
            countryInitials,
            countryName,
            countryFlagUrl,
            E214,
            tadigSummaryList,
            msisdnNumberRanges,
            gtNumberRanges,
            msrnNumberRanges,
            npNumberRanges,
            nwNodes,
            internationalSCCPGateway,
            grxIpxRouting,
            dnsInfo,
            asnInfo,
            packetDataServiceInfo,
            supportedTechnologies: network?.SupportedTechnologies?.[0] || {},
            domesticSCCPGateway: networkData?.DomesticSCCPGatewaySection?.[0] || {},

            // Raw backup
            // rawData: json,
        });

        await newFile.save();
        await unlinkAsync(req.file.path);

        res.json({ message: "File uploaded successfully", file: newFile });
    } catch (err) {
        console.error("Upload error:");
        if (req.file) {
            await unlinkAsync(req.file.path);
        }
        res.status(500).json({ error: "Failed to process XML file", details: err.message, validationErrors: err.errors });
    }
};

exports.getAllData = async (req, res) => {
    try {
        const { q, page = 1, limit = 20 } = req.query;
        const filter = {};

        if (!isNaN(q)) {
            const queryRegex = new RegExp(q, "i");
            filter.$or = [
                // top-level
                { fileName: queryRegex },
                { organisationName: queryRegex },
                { senderTADIG: queryRegex },
                { countryInitials: queryRegex },
                { countryName: queryRegex },

                // E214
                { "E214.CC": queryRegex },
                { "E214.NC": queryRegex },

                // TADIG summary
                { "tadigSummaryList.TADIGCode": queryRegex },
                { "tadigSummaryList.MCC": queryRegex },
                { "tadigSummaryList.MNC": queryRegex },
                { "tadigSummaryList.NetworkType": queryRegex },
                { "tadigSummaryList.VPMNHPMNList": queryRegex },

                // Number ranges
                { "msisdnNumberRanges.CC": queryRegex },
                { "msisdnNumberRanges.NDC": queryRegex },
                { "msisdnNumberRanges.SN_RangeStart": queryRegex },
                { "msisdnNumberRanges.SN_RangeStop": queryRegex },
                { "msisdnNumberRanges.NetworkOwner": queryRegex },
                { "gtNumberRanges.NetworkOwner": queryRegex },
                { "npNumberRanges.NetworkOwner": queryRegex },

                // Network nodes
                { "nwNodes.NwElementType": queryRegex },
                { "nwNodes.VendorInfo": queryRegex },
                { "nwNodes.IPAddressInfo.IPAddress": queryRegex },
                { "nwNodes.IPAddressInfo.IPAddressRange": queryRegex },
                { "nwNodes.GTAddressInfo.CC": queryRegex },

                // SCCP Gateways
                { "internationalSCCPGateway.carrierName": queryRegex },
                { "internationalSCCPGateway.dpcList.DPC": queryRegex },

                // GRX/IPX
                { "grxIpxRouting.grxProvider": queryRegex },
                { "grxIpxRouting.interPMNBackboneIPList.ipAddressRange": queryRegex },
                { "grxIpxRouting.interPMNBackboneIPList.networkOwner": queryRegex },

                // DNS Info
                { "dnsInfo.authoritative.ipAddress": queryRegex },
                { "dnsInfo.authoritative.dnsName": queryRegex },
                { "dnsInfo.local.ipAddress": queryRegex },
                { "dnsInfo.local.dnsName": queryRegex },

                // ASN Info
                { "asnInfo.asNumber": queryRegex },
                { "asnInfo.operator": queryRegex },

                // APN / Packet data
                { "packetDataServiceInfo.apnOperatorIdentifiers": queryRegex },
                { "packetDataServiceInfo.testingAPNs.web.credential.APN": queryRegex },
                { "packetDataServiceInfo.testingAPNs.web.primaryDNS": queryRegex },
                { "packetDataServiceInfo.testingAPNs.wap.gatewayIPAddress": queryRegex },
                { "packetDataServiceInfo.testingAPNs.mms.messagingServerURL": queryRegex },
                { "packetDataServiceInfo.qosProfiles.profileName": queryRegex },
            ];
        }

        const results = await FileData.find(filter)
            .collation({ locale: "en", strength: 2 })
            .limit(Number(limit))
            .skip((Number(page) - 1) * Number(limit))
            .sort({ fileName: 1 });

        const count = await FileData.countDocuments(filter);

        res.json({
            results,
            totalPages: Math.ceil(count / limit),
            currentPage: parseInt(page),
            totalCount: count,
        });
    } catch (err) {
        console.error("Failed to fetch data:", err);
        res.status(500).json({ error: "Failed to fetch data" });
    }
};



exports.getDataById = async (req, res) => {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: "Invalid file ID format" });
    }
    try {
        const file = await FileData.findById(id);
        if (!file) {
            return res.status(404).json({ message: "File not found" });
        }
        res.json(file);
    } catch (err) {
        console.error("Error fetching by ID:", err);
        res.status(500).json({ error: "Failed to fetch file" });
    }
};

