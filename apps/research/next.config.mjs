import { assertProcessConfiguration } from '../../config/validate-process.mjs';
assertProcessConfiguration('research');
/** @type {import('next').NextConfig} */
const config = { transpilePackages: ['@garden/domain'], poweredByHeader: false };
export default config;
