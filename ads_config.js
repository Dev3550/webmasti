// WebMasti Hybrid Ad Engine (Monetag Smartlink + Adsterra Social Bar & Native Banners)
window.WEBMASTI_ADS = {
  // 1. Popunder / On-Click Ad Script (Disabled)
  popunderScript: "", 

  // 2. Monetag Direct Ad Link (Smartlink)
  directAdLink: "https://omg10.com/4/11790325",

  // 3. Top Header Banner / Native Ad HTML Code (Adsterra Native Banner)
  topBannerCode: `
    <script async="async" data-cfasync="false" src="https://pl31272345.profitableratecpmnetwork.com/24aa9ede5467ca88bbfe69436b7de303/invoke.js"></script>
    <div id="container-24aa9ede5467ca88bbfe69436b7de303"></div>
  `,

  // 4. In-Modal Player Banner Ad HTML Code (Adsterra Native Banner)
  playerBannerCode: `
    <script async="async" data-cfasync="false" src="https://pl31272345.profitableratecpmnetwork.com/24aa9ede5467ca88bbfe69436b7de303/invoke.js"></script>
    <div id="container-24aa9ede5467ca88bbfe69436b7de303"></div>
  `,

  // 5. Push / Social Bar Ad Script (Adsterra Social Bar)
  pushAdScript: "https://pl31272460.profitableratecpmnetwork.com/2d/a0/4e/2da04e784cf609feb34466e3fd84e3e6.js",

  // Enable/Disable Ads
  enabled: true
};

// 45-Second Cooldown timer between direct smartlink popups for smooth UX & high CPM
let lastAdTriggerTime = 0;
const AD_COOLDOWN_MS = 45000;

// Helper function to trigger Monetag Direct Smartlink in background tab
window.triggerAdOnClick = function(force) {
  if (!window.WEBMASTI_ADS || !window.WEBMASTI_ADS.enabled) return;

  const now = Date.now();
  if (!force && (now - lastAdTriggerTime < AD_COOLDOWN_MS)) {
    return;
  }
  
  if (window.WEBMASTI_ADS.directAdLink && window.WEBMASTI_ADS.directAdLink.trim().length > 5) {
    try {
      // Open Smartlink in new tab and refocus WebMasti so user remains on video page
      const adWin = window.open(window.WEBMASTI_ADS.directAdLink, '_blank');
      if (adWin) {
        adWin.blur();
        window.focus();
      }
      lastAdTriggerTime = now;
    } catch (e) {
      console.log('Ad open blocked by browser pop-up setting');
    }
  }
};

