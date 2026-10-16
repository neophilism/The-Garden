import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./browser',fullyParallel:true,forbidOnly:true,retries:0,workers:2,
 timeout:45000,expect:{timeout:8000},
 reporter:[['list'],['json',{outputFile:'test-results/results.json'}],['html',{open:'never'}]],
 use:{baseURL:'http://127.0.0.1:4173',trace:'retain-on-failure',screenshot:'only-on-failure',reducedMotion:'reduce'},
 projects:[
  {name:'chromium-desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},
  {name:'chromium-mobile',use:{...devices['Pixel 7']}},
  {name:'firefox-desktop',use:{...devices['Desktop Firefox']}}
 ],
 webServer:[
  {command:'PORT=4173 node ../../scripts/serve-public.mjs',url:'http://127.0.0.1:4173',reuseExistingServer:false,timeout:30000},
  {command:'node ../../node_modules/next/dist/bin/next start ../../apps/research --hostname 127.0.0.1 --port 4174',url:'http://127.0.0.1:4174',reuseExistingServer:false,timeout:30000}
 ]
});
