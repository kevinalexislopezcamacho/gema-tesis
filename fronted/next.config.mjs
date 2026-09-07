/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // jsPDF (client-only, used for the completion certificate) pulls in a
  // Node-oriented build with a worker_threads path the bundler can't
  // statically follow — it's never actually executed during SSR (only from
  // a button's onClick), so keep it out of the server bundle entirely.
  serverExternalPackages: ["jspdf"],
}

export default nextConfig
