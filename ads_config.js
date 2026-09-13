// WebMasti Hybrid Ad Engine (Monetag Smartlink + Adsterra Social Bar & Native Banners)
window.WEBMASTI_ADS = {
  // 1. Popunder / On-Click Ad Script (Active on All Devices: Mobile, Tablet & Desktop)
  popunderScript: "https://pl31272333.profitableratecpmnetwork.com/4b/8d/f3/4b8df32a820c78a05c3140510f2d48bf.js", 

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

// Helper function to trigger Monetag Direct Smartlink in background tab (PC & Mobile Popunder)
window.triggerAdOnClick = function(force, targetUrl) {
  if (!window.WEBMASTI_ADS || !window.WEBMASTI_ADS.enabled) return false;

  const now = Date.now();
  if (!force && (now - lastAdTriggerTime < AD_COOLDOWN_MS)) {
    return false;
  }
  
  const directLink = window.WEBMASTI_ADS.directAdLink;
  if (!directLink || directLink.trim().length <= 5) return false;

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  try {
    if (isMobile && targetUrl) {
      // Mobile Tab-Swap Popunder Technique:
      // 1. Open WebMasti target URL in NEW active tab (Mobile Chrome focuses this new tab!)
      const newSiteWin = window.open(targetUrl, '_blank');
      // 2. In CURRENT background tab, navigate to Monetag Direct Ad Link!
      window.location.href = directLink;
      lastAdTriggerTime = now;
      return true; // Handled via tab-swap
    } else {
      // Desktop / Tablet Popunder Mode:
      const adWin = window.open(directLink, '_blank');
      if (adWin) {
        adWin.blur();
        window.focus();
      }
      lastAdTriggerTime = now;
      return false;
    }
  } catch (e) {
    console.log('Ad open blocked by browser pop-up setting:', e);
  }
  return false;
};

