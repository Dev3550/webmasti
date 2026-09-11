// WebMasti Smart Ad Monetization Engine
// Simply paste your Ad Codes from Monetag, PropellerAds, Adsterra, or HilltopAds below!

window.WEBMASTI_ADS = {
  // 1. Popunder / On-Click Ad Script (Triggers on click & episode switches)
  popunderScript: "https://pl31272333.profitableratecpmnetwork.com/a5/90/cc/a590cc8c91c5d6cc7ee4c0122f3b2bc1.js", 

  // 2. Direct Ad Link (Optional: Direct Smartlink URL from Monetag / Adsterra for opening ad in new tab on episode click)
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

  // 5. Push / Social Bar Ad Script (Disabled to prevent blocking mobile screen)
  pushAdScript: "",

  // Enable/Disable Ads
  enabled: true
};

// 45-Second Cooldown timer so users are not annoyed by constant popups
let lastAdTriggerTime = 0;
const AD_COOLDOWN_MS = 45000;

// Helper function to trigger popunder / click ad on user action or episode switch
window.triggerAdOnClick = function() {
  if (!window.WEBMASTI_ADS || !window.WEBMASTI_ADS.enabled) return;

  const now = Date.now();
  if (now - lastAdTriggerTime < AD_COOLDOWN_MS) {
    return; // Skip popup ad during cooldown for smooth UX
  }
  
  // If direct ad link is provided, open ad in background new tab
  if (window.WEBMASTI_ADS.directAdLink && window.WEBMASTI_ADS.directAdLink.trim().length > 5) {
    try {
      window.open(window.WEBMASTI_ADS.directAdLink, '_blank');
      lastAdTriggerTime = now;
    } catch (e) {
      console.log('Ad open blocked by browser pop-up setting');
    }
  }
};

