// WebMasti Smart Ad Monetization Engine
// Simply paste your Ad Codes from Monetag, PropellerAds, Adsterra, or HilltopAds below!

window.WEBMASTI_ADS = {
  // 1. Popunder / On-Click Ad Script (Triggers on click & episode switches)
  popunderScript: "", 

  // 2. Direct Ad Link (Optional: Direct Smartlink URL from Monetag / Adsterra for opening ad in new tab on episode click)
  directAdLink: "",

  // 3. Top Header Banner Ad HTML Code
  topBannerCode: `
    <!-- Paste Top Banner Ad Snippet Here -->
  `,

  // 4. In-Modal Player Banner Ad HTML Code
  playerBannerCode: `
    <!-- Paste Video Player Ad Snippet Here -->
  `,

  // 5. Push Ad Script
  pushAdScript: "",

  // Enable/Disable Ads
  enabled: true
};

// Helper function to trigger popunder / click ad on user action or episode switch
window.triggerAdOnClick = function() {
  if (!window.WEBMASTI_ADS || !window.WEBMASTI_ADS.enabled) return;
  
  // If direct ad link is provided, open ad in background new tab
  if (window.WEBMASTI_ADS.directAdLink && window.WEBMASTI_ADS.directAdLink.trim().length > 5) {
    try {
      window.open(window.WEBMASTI_ADS.directAdLink, '_blank');
    } catch (e) {
      console.log('Ad open blocked by browser pop-up setting');
    }
  }
};
