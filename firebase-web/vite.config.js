
import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        login: resolve(import.meta.dirname, "login.html"),
        home: resolve(import.meta.dirname, "home.html"),
        sell: resolve(import.meta.dirname, "sell.html"),
        product: resolve(import.meta.dirname, "product.html"),
        editProduct: resolve(import.meta.dirname, "edit-product.html"),
        myProducts: resolve(import.meta.dirname, "my-products.html"),
        orders: resolve(import.meta.dirname, "orders.html"),
        profile: resolve(import.meta.dirname, "profile.html"),
        moderator: resolve(import.meta.dirname, "moderator.html"),
      },
    },
  },
});
