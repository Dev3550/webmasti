// WebMasti Smart Ad Monetization Engine
// Simply paste your Ad Codes from Monetag, PropellerAds, Adsterra, or HilltopAds below!

window.WEBMASTI_ADS = {
  // 1. Popunder / On-Click Ad Script
  popunderScript: "https://pl31272333.profitableratecpmnetwork.com/a5/90/cc/a590cc8c91c5d6cc7ee4c0122f3b2bc1.js", 

  // 2. Direct Ad Link
  directAdLink: "https://www.profitableratecpmnetwork.com/b4eakvw57?key=a496ce996af212b180f35b5c908cf551",

  // 3. Top Header Banner / Native Ad HTML Code
  topBannerCode: `
    <script async="async" data-cfasync="false" src="https://pl31272345.profitableratecpmnetwork.com/24aa9ede5467ca88bbfe69436b7de303/invoke.js"></script>
    <div id="container-24aa9ede5467ca88bbfe69436b7de303"></div>
  `,

  // 4. In-Modal Player Banner Ad HTML Code
  playerBannerCode: `
    <script async="async" data-cfasync="false" src="https://pl31272345.profitableratecpmnetwork.com/24aa9ede5467ca88bbfe69436b7de303/invoke.js"></script>
    <div id="container-24aa9ede5467ca88bbfe69436b7de303"></div>
  `,

  // 5. Push / Social Bar Ad Script (Loaded ONLY on Desktop/Tablet > 768px)
  pushAdScript: "https://pl31272460.profitableratecpmnetwork.com/2d/a0/4e/2da04e784cf609feb34466e3fd84e3e6.js",

  // Enable/Disable Ads
  enabled: true
};

// 25-Second Cooldown timer between popups
let lastAdTriggerTime = 0;
const AD_COOLDOWN_MS = 25000;

// Helper function to trigger popunder / click ad on user action or episode switch
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

