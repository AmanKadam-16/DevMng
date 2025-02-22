import { pgTable, text, serial, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Location schemas
export const locationSchema = z.object({
  LocationCode: z.number(),
  LocationName: z.string()
});

export const createLocationSchema = z.object({
  LocationName: z.string().min(1, "Location name is required")
});

export type Location = z.infer<typeof locationSchema>;
export type CreateLocation = z.infer<typeof createLocationSchema>;

// Device Details from local API
export const deviceDetailsSchema = z.object({
  DevIndex: z.string(),
  DevName: z.string(),
  DevLocation: z.number(),
  DevLocationName: z.string(),
  CreateDate: z.string(),
  UpdateDate: z.string(),
  IsDeleted: z.boolean()
});

export type DeviceDetails = z.infer<typeof deviceDetailsSchema>;

// Device from remote API
export const deviceSchema = z.object({
  ISAPIParams: z.object({
    address: z.string(),
    addressingFormatType: z.string(),
    portNo: z.number()
  }),
  activeStatus: z.boolean().optional(),
  devIndex: z.string(),
  devMode: z.string(),
  devName: z.string(),
  devStatus: z.string(),
  devType: z.string(),
  devVersion: z.string(),
  protocolType: z.string(),
  videoChannelNum: z.number(),
  offlineHint: z.number().optional()
});

export type Device = z.infer<typeof deviceSchema>;

export const deviceListResponseSchema = z.object({
  SearchResult: z.object({
    MatchList: z.array(z.object({
      Device: deviceSchema
    })),
    numOfMatches: z.number(),
    totalMatches: z.number()
  })
});

export type DeviceListResponse = z.infer<typeof deviceListResponseSchema>;

export const addDeviceSchema = z.object({
  protocolType: z.literal("ISAPI"),
  devName: z.string().min(1, "Device name is required"),
  devType: z.literal("AccessControl"),
  address: z.string().ip("IPv4"),
  portNo: z.number().int().min(1).max(65535),
  userName: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  location: z.number().min(1, "Location is required")
});

export const createLocalDeviceSchema = z.object({
  DevIndex: z.string(),
  DevName: z.string(),
  DevLocation: z.number()
});

export type AddDeviceInput = z.infer<typeof addDeviceSchema>;
export type CreateLocalDevice = z.infer<typeof createLocalDeviceSchema>;

export const employeeSearchSchema = z.object({
  UserInfoSearchCond: z.object({
    searchID: z.string(),
    searchResultPosition: z.number(),
    maxResults: z.number()
  })
});

export const employeeSchema = z.object({
  employeeNo: z.string(),
  name: z.string(),
  userType: z.string(),
  closeDelayEnabled: z.boolean(),
  Valid: z.object({
    enable: z.boolean(),
    timeType: z.string(),
    beginTime: z.string(),
    endTime: z.string()
  }),
  password: z.string(),
  doorRight: z.string(),
  RightPlan: z.array(z.object({
    doorNo: z.number(),
    planTemplateNo: z.string()
  })),
  maxOpenDoorTime: z.number(),
  openDoorTime: z.number(),
  localUIRight: z.boolean(),
  userVerifyMode: z.string()
});

export const employeeListResponseSchema = z.object({
  UserInfoSearch: z.object({
    searchID: z.string(),
    responseStatusStrg: z.string(),
    numOfMatches: z.number(),
    totalMatches: z.number(),
    UserInfo: z.array(employeeSchema)
  })
});

export type EmployeeSearchInput = z.infer<typeof employeeSearchSchema>;
export type Employee = z.infer<typeof employeeSchema>;
export type EmployeeListResponse = z.infer<typeof employeeListResponseSchema>;