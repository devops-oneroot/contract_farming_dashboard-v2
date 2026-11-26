import type { MetadataRoute } from "next";

// Lets the dashboard be added to a phone's home screen. iPhones only allow web
// push (enquiry notifications) for a site opened from the home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OneRoot Contract Farming",
    short_name: "OneRoot",
    description: "Manage farmers, agronomists, package of practices and products",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ff6200",
    icons: [{ src: "/favicon.png", sizes: "any", type: "image/png" }],
  };
}
