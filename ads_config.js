// WebMasti Monetag Smart Ad Engine
window.WEBMASTI_ADS = {
  // 1. Popunder / On-Click Ad Script (Disabled)
  popunderScript: "", 

  // 2. Monetag Direct Ad Link (Smartlink)
  directAdLink: "https://omg10.com/4/11790325",

  // 3. Top Header Banner / Native Ad HTML Code (Adsterra Disabled)
  topBannerCode: "",

  // 4. In-Modal Player Banner Ad HTML Code (Adsterra Disabled)
  playerBannerCode: "",

  // 5. Push / Social Bar Ad Script (Adsterra Disabled)
  pushAdScript: "",

  // Enable/Disable Ads
  enabled: true
};

// 45-Second Cooldown timer between direct smartlink popups for smooth UX & high CPM
let lastAdTriggerTime = 0;
const AD_COOLDOWN_MS = 45000;

// Helper function to trigger Monetag Direct Smartlink on user action
window.triggerAdOnClick = function(force) {
  if (!window.WEBMASTI_ADS || !window.WEBMASTI_ADS.enabled) return;

  const now = Date.now();
  if (!force && (now - lastAdTriggerTime < AD_COOLDOWN_MS)) {
    return;
  }
  
  if (window.WEBMASTI_ADS.directAdLink && window.WEBMASTI_ADS.directAdLink.trim().length > 5) {
    try {
      window.open(window.WEBMASTI_ADS.directAdLink, '_blank');
      lastAdTriggerTime = now;
    } catch (e) {
      console.log('Ad open blocked by browser pop-up setting');
    }
  }
};

