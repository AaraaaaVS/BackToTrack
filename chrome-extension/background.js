const DEFAULT_SITES = ["youtube.com", "reddit.com", "instagram.com"];

function getTodayDate() {
  return new Date().toLocaleDateString('en-CA');
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("watchdog", { periodInMinutes: 0.5 });
  chrome.storage.sync.get(["trackedSites"], (res) => {
    if (!res.trackedSites) {
      chrome.storage.sync.set({ trackedSites: DEFAULT_SITES });
    }
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "watchdog") trackActiveTime();
});

async function trackActiveTime() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.url) return;

  const res = await chrome.storage.sync.get(["trackedSites", "focusStart", "focusEnd"]);
  const trackedSites = res.trackedSites || DEFAULT_SITES;
  
  const matchedSite = trackedSites.find(site => tabs[0].url.includes(site));

  if (matchedSite) {
    const today = getTodayDate();
    const data = await chrome.storage.local.get([today]);
    let dayData = data[today] || {};
    
    // --- NEW: FOCUS ZONE LOGIC ---
    const now = new Date();
    const currentHour = now.getHours();
    
    // Default Buckets
    let bucket = 'night'; 
    if (currentHour >= 5 && currentHour < 12) bucket = 'morning';
    else if (currentHour >= 12 && currentHour < 18) bucket = 'afternoon';

    // Check Custom Focus Hours
    // Format: "09:00" -> 9
    if (res.focusStart && res.focusEnd) {
        const startH = parseInt(res.focusStart.split(':')[0]);
        const endH = parseInt(res.focusEnd.split(':')[0]);
        
        // Simple logic: if start < end (e.g., 9 to 17)
        if (startH < endH) {
            if (currentHour >= startH && currentHour < endH) bucket = 'focus';
        }
        // Logic for overnight (e.g., 22 to 06)
        else {
            if (currentHour >= startH || currentHour < endH) bucket = 'focus';
        }
    }

    // Initialize object if needed
    if (!dayData[matchedSite] || typeof dayData[matchedSite] === 'number') {
        const oldTime = typeof dayData[matchedSite] === 'number' ? dayData[matchedSite] : 0;
        dayData[matchedSite] = {
            total: oldTime,
            morning: 0,
            afternoon: 0,
            night: 0,
            focus: 0 // New bucket
        };
    }

    // Add time to bucket
    if (!dayData[matchedSite][bucket]) dayData[matchedSite][bucket] = 0;
    dayData[matchedSite][bucket] += 30;
    dayData[matchedSite].total += 30;

    await chrome.storage.local.set({ [today]: dayData });
    console.log(`[${today}] ${matchedSite} (${bucket}): ${dayData[matchedSite].total}s`);
  }
}