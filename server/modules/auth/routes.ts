import type { Express } from "express";
import passport from "passport";
import { storage } from "../../storage";

export function registerAuthRoutes(app: Express) {
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login error" });
        }
        res.json({
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          profileImageUrl: user.profileImageUrl,
          defaultStoreId: user.defaultStoreId,
        });
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    console.log("Logout request received");

    req.logout((logoutErr) => {
      if (logoutErr) {
        console.error("Logout error:", logoutErr);
      }

      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error("Session destroy error:", sessionErr);
        }

        res.clearCookie("connect.sid", {
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "lax",
        });

        res.clearCookie("connect.sid");

        console.log("Logout successful, session cleared");

        res.json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/auth/user", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const user = await storage.getUserById(req.user.id);
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "User account not found or inactive" });
      }

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        profileImageUrl: user.profileImageUrl,
        defaultStoreId: user.defaultStoreId,
      });
    } catch (error) {
      console.error("Error fetching user data:", error);
      return res.status(500).json({ message: "Error retrieving user data" });
    }
  });

  app.post("/api/auth/refresh", (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.session.regenerate((sessionErr) => {
      if (sessionErr) {
        console.error("Session regeneration error:", sessionErr);
        return res.status(500).json({ message: "Session refresh failed" });
      }

      req.logIn(req.user!, (loginErr) => {
        if (loginErr) {
          console.error("Re-login error:", loginErr);
          return res.status(500).json({ message: "Session refresh failed" });
        }

        res.json({ message: "Session refreshed successfully" });
      });
    });
  });
}
