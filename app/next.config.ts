import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow local network access during development
  // Add your local network IP addresses here
  allowedDevOrigins: [
    '192.168.1.2', // Your current local network IP
    // Add more IPs if needed, e.g.:
    // '192.168.1.3',
    // '10.0.0.2',
  ],
};

export default nextConfig;
