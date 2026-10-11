import { assertProcessConfiguration } from '../../config/validate-process.mjs';
assertProcessConfiguration('public');
/** @type {import('next').NextConfig} */
const config = { output: 'export', trailingSlash: true, transpilePackages: ['@garden/domain'], poweredByHeader: false };
export default config;
