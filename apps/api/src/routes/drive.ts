import express from "express";
import axios from "axios";

const router: express.Router = express.Router();

// Proxy a Google Drive file by id. Example: GET /api/v1/drive/FILE_ID
// This fetches the Drive view/download URL server-side and streams it to clients
// to avoid CORB/ORB issues when the browser would otherwise block cross-origin responses.
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    // Allow optional ?url= override
    const sourceUrl = req.query.url
      ? String(req.query.url)
      : `https://drive.google.com/uc?export=view&id=${encodeURIComponent(id)}`;

    const response = await axios.get(sourceUrl, {
      responseType: "stream",
      // follow redirects and accept non-2xx temporarily; we'll forward status if necessary
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (response.status >= 400) {
      res.status(response.status).send(`Upstream returned ${response.status}`);
      return;
    }

    // Forward relevant headers
    const contentType = response.headers["content-type"];
    if (contentType) {
      res.setHeader("Content-Type", String(contentType));
    } else {
      res.setHeader("Content-Type", "application/octet-stream");
    }
    if (response.headers["content-length"]) {
      res.setHeader(
        "Content-Length",
        String(response.headers["content-length"]),
      );
    }
    // Cache for an hour
    res.setHeader("Cache-Control", "public, max-age=3600");

    response.data.pipe(res);
  } catch (err) {
    next(err);
  }
});

export default router;
