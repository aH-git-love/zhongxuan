/* One coherent release: promotional homepage + preserved app + complete artwork. */
process.argv.push('--files='+[
 'index.html','landing.html','app.html','css/app.css','css/landing.css',
 'js/app.js','js/tarot.js','js/landing.js','sw.js','manifest.webmanifest',
 'art-credits.html','README.md','server.js','assets/tarot/rws/sources.json',
 'docs/tarot-art-sources.md','tools/fetch_tarot_art.py','tools/build_tarot_site.js',
 'tools/test_real_tarot_site.js','tools/test_landing_routes.js','tools/test_sw.js',
 'tools/test_web_update.js','tools/test_tarot_palace.js','tools/test_brain_browser.js',
 'tools/cdp_online_check.js','tools/verify_brain_live.js','tools/publish_web_only.js',
 'tools/publish_real_tarot.js'
].join(','),'--include-art','--message=Launch promotional homepage with authentic 78-card RWS artwork and offline app');
require('./publish_web_only.js');
