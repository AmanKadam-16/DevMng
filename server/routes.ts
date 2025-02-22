import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import fetch from "node-fetch";
import crypto from "crypto";
import { nanoid } from 'nanoid'; // Assuming nanoid is already installed and available

const DEVICE_API_BASE_URL = "https://f2dnqr5n-8085.inc1.devtunnels.ms";
const LOCAL_API_BASE_URL = "https://s3fq18s0-58122.inc1.devtunnels.ms";
const DEVICE_USERNAME = "admin";
const DEVICE_PASSWORD = "Insignia@12";

// Digest auth helpers for remote API
const generateCNonce = () => {
  const characters = "abcdef0123456789";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const parseDigestHeader = (header: string) => {
  const params: Record<string, string> = {};
  header
    .replace(/Digest\s+/, "")
    .split(",")
    .forEach((part) => {
      const [key, value] = part.trim().split("=");
      params[key] = value?.replace(/"/g, "");
    });
  return params;
};

const generateDigestResponse = (
  method: string,
  uri: string,
  authParams: Record<string, string>,
) => {
  const cnonce = generateCNonce();
  const nc = "00000001";
  const qop = authParams.qop;
  const { realm, nonce } = authParams;
  const username = DEVICE_USERNAME;
  const password = DEVICE_PASSWORD;

  const ha1 = crypto
    .createHash("md5")
    .update(`${username}:${realm}:${password}`)
    .digest("hex");
  const ha2 = crypto.createHash("md5").update(`${method}:${uri}`).digest("hex");
  const response = crypto
    .createHash("md5")
    .update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`)
    .digest("hex");

  return {
    username,
    realm,
    nonce,
    uri,
    qop,
    nc,
    cnonce,
    response,
    algorithm: "MD5",
  };
};

export function registerRoutes(app: Express): Server {
  // Get all locations
  app.get('/api/locations/all', async (_req, res) => {
    try {
      const response = await fetch(`${LOCAL_API_BASE_URL}/api/locations/all`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching locations:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  });

  // Create location
  app.post('/api/locations/create', async (req, res) => {
    try {
      const response = await fetch(`${LOCAL_API_BASE_URL}/api/locations/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error creating location:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  });

  // Create local device
  app.post('/api/local-device', async (req, res) => {
    try {
      const response = await fetch(`${LOCAL_API_BASE_URL}/CreateDevice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body),
      });
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error creating local device:', error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  });

  // Device List endpoint (Remote API with auth)
  app.post("/api/devices", async (req, res) => {
    const endpoint = "/ISAPI/ContentMgmt/DeviceMgmt/deviceList?format=json";

    try {
      // Generate unique searchID for device list request
      const searchID = nanoid();
      const requestBody = {
        SearchDescription: {
          position: 0,
          maxResult: 100,
          searchID,
          Filter: {
            key: "",
            devType: "",
            protocolType: ["ISAPI"],
            devStatus: ["online", "offline"],
          },
        },
      };

      // Initial request to get digest challenge
      const initialResponse = await fetch(`${DEVICE_API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (initialResponse.status === 401) {
        const authHeader = initialResponse.headers.get("www-authenticate");
        if (!authHeader) throw new Error("No authentication header received");

        const authParams = parseDigestHeader(authHeader);
        const digestResponse = generateDigestResponse(
          "POST",
          endpoint,
          authParams,
        );

        const authString = Object.entries(digestResponse)
          .map(([key, value]) => `${key}="${value}"`)
          .join(", ");

        // Authenticated request
        const authenticatedResponse = await fetch(
          `${DEVICE_API_BASE_URL}${endpoint}`,
          {
            method: "POST",
            headers: {
              Authorization: `Digest ${authString}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
        );

        if (!authenticatedResponse.ok) {
          throw new Error(
            `HTTP error! status: ${authenticatedResponse.status}`,
          );
        }

        const data = await authenticatedResponse.json();
        res.json(data);
      } else {
        res
          .status(500)
          .json({ message: "Unexpected response from device API" });
      }
    } catch (error) {
      console.error("Error fetching devices:", error);
      res
        .status(500)
        .json({
          message:
            error instanceof Error ? error.message : "Internal Server Error",
        });
    }
  });

  // Device Details endpoint (Local API, no auth needed)
  app.get('/api/device-details', async (_req, res) => {
    try {
      const fullUrl = `${LOCAL_API_BASE_URL}/GetAllDeviceDetails`;
      console.log('Attempting to fetch device details from:', fullUrl);

      // Direct GET request to local API
      const response = await fetch(fullUrl);

      console.log('Device details API response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Device details API response data:', data);
      res.json(data);
    } catch (error) {
      console.error('Error fetching device details:', error);
      console.error('Full error details:', {
        message: error instanceof Error ? error.message : 'Internal Server Error',
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({ message: error instanceof Error ? error.message : 'Internal Server Error' });
    }
  });

  // Add Device endpoint
  app.post("/api/devices/add", async (req, res) => {
    const endpoint = "/ISAPI/ContentMgmt/DeviceMgmt/addDevice?format=json&security=1&iv=dd73aa89cec74314c4e080d82faba24b";

    try {
      const initialResponse = await fetch(`${DEVICE_API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          DeviceInList: [{
            Device: {
              protocolType: req.body.protocolType,
              devName: req.body.devName,
              devType: req.body.devType,
              ISAPIParams: {
                addressingFormatType: "IPV4Address",
                address: req.body.address,
                portNo: req.body.portNo,
                userName: req.body.userName,
                password: req.body.password
              }
            }
          }]
        }),
      });

      if (initialResponse.status === 401) {
        const authHeader = initialResponse.headers.get("www-authenticate");
        if (!authHeader) throw new Error("No authentication header received");

        const authParams = parseDigestHeader(authHeader);
        const digestResponse = generateDigestResponse(
          "POST",
          endpoint,
          authParams,
        );

        const authString = Object.entries(digestResponse)
          .map(([key, value]) => `${key}="${value}"`)
          .join(", ");

        const authenticatedResponse = await fetch(
          `${DEVICE_API_BASE_URL}${endpoint}`,
          {
            method: "POST",
            headers: {
              Authorization: `Digest ${authString}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              DeviceInList: [{
                Device: {
                  protocolType: req.body.protocolType,
                  devName: req.body.devName,
                  devType: req.body.devType,
                  ISAPIParams: {
                    addressingFormatType: "IPV4Address",
                    address: req.body.address,
                    portNo: req.body.portNo,
                    userName: req.body.userName,
                    password: req.body.password
                  }
                }
              }]
            }),
          },
        );

        if (!authenticatedResponse.ok) {
          throw new Error(`HTTP error! status: ${authenticatedResponse.status}`);
        }

        const data = await authenticatedResponse.json();

        // After successful ISAPI device creation, create in local DB
        if (data.DeviceOutList?.[0]?.Device?.status === 'success') {
          const localDeviceResponse = await fetch(`${LOCAL_API_BASE_URL}/CreateDevice`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              DevIndex: data.DeviceOutList[0].Device.devIndex,
              DevName: req.body.devName,
              DevLocation: req.body.location
            }),
          });

          if (!localDeviceResponse.ok) {
            throw new Error('Failed to create device in local database');
          }
        }

        res.json(data);
      } else {
        res.status(500).json({ message: "Unexpected response from device API" });
      }
    } catch (error) {
      console.error("Error adding device:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  });

  // Employee List endpoint
  app.post("/api/employees/:deviceId", async (req, res) => {
    const { deviceId } = req.params;
    const endpoint = `/ISAPI/AccessControl/UserInfo/Search?format=json&devIndex=${deviceId}`;

    try {
      const initialResponse = await fetch(`${DEVICE_API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      if (initialResponse.status === 401) {
        const authHeader = initialResponse.headers.get("www-authenticate");
        if (!authHeader) throw new Error("No authentication header received");

        const authParams = parseDigestHeader(authHeader);
        const digestResponse = generateDigestResponse(
          "POST",
          endpoint,
          authParams,
        );

        const authString = Object.entries(digestResponse)
          .map(([key, value]) => `${key}="${value}"`)
          .join(", ");

        const authenticatedResponse = await fetch(
          `${DEVICE_API_BASE_URL}${endpoint}`,
          {
            method: "POST",
            headers: {
              Authorization: `Digest ${authString}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(req.body),
          },
        );

        if (!authenticatedResponse.ok) {
          throw new Error(`HTTP error! status: ${authenticatedResponse.status}`);
        }

        const data = await authenticatedResponse.json();
        res.json(data);
      } else {
        res.status(500).json({ message: "Unexpected response from device API" });
      }
    } catch (error) {
      console.error("Error fetching employees:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  });

  app.put("/api/employees/:deviceId/modify", async (req, res) => {
    const { deviceId } = req.params;
    const endpoint = `/ISAPI/AccessControl/UserInfo/Modify?format=json&devIndex=${deviceId}`;

    try {
      const initialResponse = await fetch(`${DEVICE_API_BASE_URL}${endpoint}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      if (initialResponse.status === 401) {
        const authHeader = initialResponse.headers.get("www-authenticate");
        if (!authHeader) throw new Error("No authentication header received");

        const authParams = parseDigestHeader(authHeader);
        const digestResponse = generateDigestResponse(
          "PUT",
          endpoint,
          authParams,
        );

        const authString = Object.entries(digestResponse)
          .map(([key, value]) => `${key}="${value}"`)
          .join(", ");

        const authenticatedResponse = await fetch(
          `${DEVICE_API_BASE_URL}${endpoint}`,
          {
            method: "PUT",
            headers: {
              Authorization: `Digest ${authString}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(req.body),
          },
        );

        if (!authenticatedResponse.ok) {
          throw new Error(`HTTP error! status: ${authenticatedResponse.status}`);
        }

        const data = await authenticatedResponse.json();
        res.json(data);
      } else {
        res.status(500).json({ message: "Unexpected response from device API" });
      }
    } catch (error) {
      console.error("Error modifying employees:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  });

  // Delete Device endpoint
  app.post("/api/devices/delete", async (req, res) => {
    const endpoint = "/ISAPI/ContentMgmt/DeviceMgmt/delDevice?format=json";

    try {
      // Initial request to get digest challenge
      const initialResponse = await fetch(`${DEVICE_API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          DevIndexList: Array.isArray(req.body.DevIndexList) ? req.body.DevIndexList : [req.body.DevIndexList]
        }),
      });

      if (initialResponse.status === 401) {
        const authHeader = initialResponse.headers.get("www-authenticate");
        if (!authHeader) throw new Error("No authentication header received");

        const authParams = parseDigestHeader(authHeader);
        const digestResponse = generateDigestResponse(
          "POST",
          endpoint,
          authParams,
        );

        const authString = Object.entries(digestResponse)
          .map(([key, value]) => `${key}="${value}"`)
          .join(", ");

        // Authenticated request
        const authenticatedResponse = await fetch(
          `${DEVICE_API_BASE_URL}${endpoint}`,
          {
            method: "POST",
            headers: {
              Authorization: `Digest ${authString}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              DevIndexList: Array.isArray(req.body.DevIndexList) ? req.body.DevIndexList : [req.body.DevIndexList]
            }),
          },
        );

        if (!authenticatedResponse.ok) {
          throw new Error(`HTTP error! status: ${authenticatedResponse.status}`);
        }

        const data = await authenticatedResponse.json();

        // Also delete from local database
        await fetch(`${LOCAL_API_BASE_URL}/DeleteDevice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            DevIndex: Array.isArray(req.body.DevIndexList) ? req.body.DevIndexList[0] : req.body.DevIndexList
          }),
        });

        res.json(data);
      } else {
        res.status(500).json({ message: "Unexpected response from device API" });
      }
    } catch (error) {
      console.error("Error deleting device:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  });

  // Employee Transfer endpoint
  app.post("/api/devices/:deviceId/transfer", async (req, res) => {
    const { deviceId } = req.params;
    const endpoint = `/ISAPI/AccessControl/UserInfo/Record?format=json&devIndex=${deviceId}`;

    try {
      console.log('Transfer Request - Device ID:', deviceId);
      // Generate a unique searchID for this request
      const searchID = nanoid();
      const requestBody = {
        ...req.body,
        searchID
      };
      console.log('Transfer Request Body:', JSON.stringify(requestBody, null, 2));

      const initialResponse = await fetch(`${DEVICE_API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (initialResponse.status === 401) {
        const authHeader = initialResponse.headers.get("www-authenticate");
        if (!authHeader) throw new Error("No authentication header received");

        const authParams = parseDigestHeader(authHeader);
        const digestResponse = generateDigestResponse(
          "POST",
          endpoint,
          authParams,
        );

        const authString = Object.entries(digestResponse)
          .map(([key, value]) => `${key}="${value}"`)
          .join(", ");

        console.log('Making authenticated transfer request to:', `${DEVICE_API_BASE_URL}${endpoint}`);

        const authenticatedResponse = await fetch(
          `${DEVICE_API_BASE_URL}${endpoint}`,
          {
            method: "POST",
            headers: {
              Authorization: `Digest ${authString}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
          },
        );

        if (!authenticatedResponse.ok) {
          const errorBody = await authenticatedResponse.text();
          console.error('Transfer API Error Response:', {
            status: authenticatedResponse.status,
            statusText: authenticatedResponse.statusText,
            body: errorBody
          });
          throw new Error(`HTTP error! status: ${authenticatedResponse.status}\nResponse: ${errorBody}`);
        }

        const data = await authenticatedResponse.json();
        console.log('Transfer API Success Response:', JSON.stringify(data, null, 2));
        res.json(data);
      } else {
        res.status(500).json({ message: "Unexpected response from device API" });
      }
    } catch (error) {
      console.error("Error transferring employees:", error);
      console.error("Full error details:", {
        message: error instanceof Error ? error.message : "Internal Server Error",
        stack: error instanceof Error ? error.stack : undefined
      });
      res.status(500).json({
        message: error instanceof Error ? error.message : "Internal Server Error",
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}