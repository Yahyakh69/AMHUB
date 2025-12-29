import { WorkflowRequest, AppSettings, TopologyResponse, Device, DeviceTelemetry } from '../types';

const PROXY_BASE = "https://corsproxy.io/?";

export const sendWorkflowAlert = async (payload: WorkflowRequest, settings: AppSettings): Promise<any> => {
  try {
    const targetUrl = PROXY_BASE + encodeURIComponent(settings.apiUrl);

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': settings.userToken,
        'x-project-uuid': settings.projectUuid
      },
      body: JSON.stringify(payload)
    });

    let responseData;
    const contentType = response.headers.get("content-type");
    
    if (contentType && contentType.includes("application/json")) {
      responseData = await response.json();
    } else {
      const text = await response.text();
      responseData = { message: text || response.statusText };
    }

    if (!response.ok) {
      throw new Error(responseData.message || `HTTP Error: ${response.status}`);
    }

    return responseData;
  } catch (error) {
    console.error("API Service Error:", error);
    throw error;
  }
};

// Helper: Recursively traverse the entire JSON tree to find ALL device-like objects
// This fixes the issue where map() only checked the top-level containers (like Workspaces) 
// and missed the actual devices inside them.
const collectAllDevices = (node: any, collected: any[]) => {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    node.forEach(item => collectAllDevices(item, collected));
    return;
  }

  // 1. Check if the current node IS a device
  // Heuristic: Must have some identifier like device_sn, sn, or child_device_sn.
  // We use a looser check for UUID but require other device indicators to avoid picking up Folders/Projects.
  const sn = node.device_sn || node.sn || node.child_device_sn;
  const hasDeviceIndicators = node.device_model || node.model || node.domain !== undefined || node.online !== undefined || node.battery || node.position || node.telemetry;

  if (sn || (node.uuid && hasDeviceIndicators)) {
     collected.push(node);
  }

  // 2. Recurse into known container properties
  // We explicitly check common keys where devices hide
  const keysToTraverse = ['children', 'list', 'data', 'host', 'drone', 'payload', 'devices', 'sub_devices'];
  
  keysToTraverse.forEach(key => {
     if (node[key]) {
         collectAllDevices(node[key], collected);
     }
  });
};

// Helper to check if a name is a generic system ID (e.g., 0-100-1 or 0-0-1)
const isGenericId = (name: string): boolean => {
    if (!name) return true;
    return /^\d+-\d+-\d+$/.test(name) || /^\d+$/.test(name);
};

export const getProjectTopology = async (settings: AppSettings): Promise<TopologyResponse> => {
  try {
    const urlObj = new URL(settings.apiUrl);
    const domain = urlObj.origin; 
    const topologyPath = `${domain}/manage/api/v1.0/projects/${settings.projectUuid}/topologies`;
    const targetUrl = PROXY_BASE + encodeURIComponent(topologyPath);

    console.log("Fetching Topology:", topologyPath);

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-User-Token': settings.userToken,
        'x-project-uuid': settings.projectUuid
      }
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => response.statusText);
        throw new Error(`Topology API Error: ${response.status} - ${errText.substring(0, 100)}`);
    }

    const rawData = await response.json().catch(() => null);
    
    if (!rawData) {
        throw new Error("Invalid JSON response from API");
    }
    
    // STEP 1: Flatten the tree into a list of potential device objects
    const rawDeviceList: any[] = [];
    collectAllDevices(rawData, rawDeviceList);

    // STEP 2: Map and Deduplicate
    const processedMap = new Map<string, Device>();

    rawDeviceList.forEach((d: any) => {
         try {
             // Basic ID Resolution
             const sn = d.device_sn || d.sn || d.child_device_sn || d.uuid || d.id || `UNKNOWN-${Math.random().toString(36).substr(2, 5)}`;
             
             // If we already processed this SN, skip (unless this one has better data, e.g. online?)
             // Simple dedup: first one wins usually works if tree traversal is top-down
             if (processedMap.has(sn)) return;

             // Status check
             const statusRaw = d.status ?? d.online ?? d.is_online;
             const isOnline = Boolean(statusRaw === true || statusRaw === 1 || statusRaw === 'true');

             // Name Resolution
             const possibleNames = [
                 d.callsign, d.nickname, d.device_name, d.name,
                 // Sometimes name is in a nested config object?
                 d.config?.name
             ];
             
             const bestName = possibleNames.find(n => 
                n && typeof n === 'string' && n.trim().length > 0 && n.trim() !== 'null' && !isGenericId(n)
             );

             // Model Resolution
             let modelRaw = d.device_model || d.model || d.sub_type || d.type;
             let model = 'DJI Device';
             if (modelRaw) {
                if (typeof modelRaw === 'string') {
                    model = modelRaw;
                } else if (typeof modelRaw === 'object') {
                    model = modelRaw.name || modelRaw.key || modelRaw.model || JSON.stringify(modelRaw);
                }
             }

             let finalName = bestName;
             if (!finalName) {
                finalName = `${model} (${String(sn).substring(0, 4)})`;
             } 

             // Telemetry / Position Extraction
             // Sometimes position is in 'position', sometimes 'telemetry'
             const offlinePos = d.device_offline_position || d.offline_position;
             
             let telSource = null;
             if (isOnline) {
                 telSource = d.telemetry || d.position || d; 
             } else if (offlinePos && (offlinePos.latitude || offlinePos.lat)) {
                 telSource = offlinePos;
             }

             let safeTelemetry: DeviceTelemetry | undefined = undefined;
             
             if (telSource) {
                 const batteryObj = d.battery || telSource.battery || {};
                 const batteryVal = Number(
                    batteryObj.capacity_percent ?? 
                    batteryObj.percent ?? 
                    telSource.battery_percent ?? 
                    telSource.capacity_percent ??
                    0
                 );

                 safeTelemetry = {
                   latitude:  Number(telSource.latitude || telSource.lat) || 0,
                   longitude: Number(telSource.longitude || telSource.lng || telSource.lon) || 0,
                   height:    Number(telSource.height || telSource.alt || telSource.altitude) || 0,
                   speed:     Number(telSource.speed || telSource.velocity) || 0,
                   battery_percent: batteryVal,
                   link_signal_quality: Number(telSource.link_signal_quality || telSource.signal) || 0,
                   flight_time: Number(telSource.flight_time) || 0,
                   yaw:   Number(telSource.yaw || telSource.heading) || 0,
                   pitch: Number(telSource.pitch) || 0,
                   roll:  Number(telSource.roll) || 0
                 };
             }

             processedMap.set(String(sn), {
                 device_sn: String(sn),
                 nickname: String(finalName),
                 device_model: String(model),
                 status: isOnline,
                 domain: Number(d.domain) || 0,
                 telemetry: safeTelemetry,
                 raw: d // Keep raw for debugging
             });

         } catch (innerError) {
             console.error("Error parsing individual device:", d, innerError);
         }
    });

    const mappedDevices = Array.from(processedMap.values());

    return {
        code: rawData.code || 0,
        message: rawData.message || "Success",
        data: mappedDevices
    };

  } catch (error) {
    console.error("Topology Fetch Error:", error);
    return { code: -1, message: String(error), data: [] };
  }
};