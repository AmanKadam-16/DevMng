import { useState } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Trash2, RefreshCw, Plus, Users } from "lucide-react";
import type { DeviceListResponse, DeviceDetails, AddDeviceInput, Location, CreateLocation } from "@shared/schema";
import { addDeviceSchema, createLocationSchema } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function Devices() {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false);

  const { data: deviceListData, isLoading: isLoadingDevices, isError: isDevicesError, refetch: refetchDevices } = useQuery<DeviceListResponse>({
    queryKey: ['/api/devices'],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/devices', {
        SearchDescription: {
          position: 0,
          maxResult: 100,
          Filter: {
            key: "",
            devType: "",
            protocolType: ["ISAPI"],
            devStatus: ["online", "offline"],
          },
        },
      });
      return response.json();
    }
  });

  const { data: deviceDetailsData, isLoading: isLoadingDetails, refetch: refetchDetails } = useQuery<DeviceDetails[]>({
    queryKey: ['/api/device-details']
  });

  const { data: locationsData, isLoading: isLoadingLocations, refetch: refetchLocations } = useQuery<Location[]>({
    queryKey: ['/api/locations/all']
  });

  const deleteDevice = useMutation({
    mutationFn: async (devIndex: string) => {
      await apiRequest('POST', '/api/devices/delete', {
        DevIndexList: [devIndex]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/device-details'] });
      toast({
        title: "Device deleted",
        description: "The device has been successfully removed.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const refreshAllData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchDevices(),
        refetchDetails(),
        refetchLocations()
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isLoading = isLoadingDevices || isLoadingDetails || isLoadingLocations;

  const form = useForm<AddDeviceInput>({
    resolver: zodResolver(addDeviceSchema),
    defaultValues: {
      protocolType: "ISAPI",
      devType: "AccessControl",
      portNo: 80,
    },
    mode: "onSubmit" // Only validate on form submission
  });

  const locationForm = useForm<CreateLocation>({
    resolver: zodResolver(createLocationSchema),
    mode: "onSubmit" // Only validate on form submission
  });

  const addLocation = useMutation({
    mutationFn: async (data: CreateLocation) => {
      await apiRequest('POST', '/api/locations/create', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/locations/all'] });
      setIsAddLocationOpen(false);
      locationForm.reset();
      form.clearErrors(); // Clear any validation errors from the device form
      toast({
        title: "Success",
        description: "Location added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const addDevice = useMutation({
    mutationFn: async (data: AddDeviceInput) => {
      await apiRequest('POST', '/api/devices/add', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/device-details'] });
      setIsAddDeviceOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Device added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleAddLocationClick = () => {
    form.clearErrors(); // Clear any validation errors from the device form
    setIsAddLocationOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <RefreshCw className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (isDevicesError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-destructive">Failed to load devices</p>
        <Button onClick={refreshAllData}>Retry</Button>
      </div>
    );
  }

  const deviceDetailsMap = new Map(
    deviceDetailsData?.map(details => [details.DevIndex, details]) ?? []
  );

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8 max-w-[1400px]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Device Management</h1>
        <div className="flex gap-2">
          <Dialog open={isAddDeviceOpen} onOpenChange={(open) => {
            setIsAddDeviceOpen(open);
            if (!open) {
              form.clearErrors(); // Clear validation errors when dialog closes
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                Add Device
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Device</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit((data) => addDevice.mutate(data))} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="devName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Device Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter device name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>IP Address</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="192.168.1.100" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="portNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="number"
                            onChange={e => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="userName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input {...field} type="password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 items-end">
                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Location</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a location" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {locationsData?.map((location) => (
                                <SelectItem
                                  key={location.LocationCode}
                                  value={location.LocationCode.toString()}
                                >
                                  {location.LocationName}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Dialog open={isAddLocationOpen} onOpenChange={(open) => {
                      setIsAddLocationOpen(open);
                      if (!open) {
                        locationForm.reset(); // Reset location form when dialog closes
                        form.clearErrors(); // Clear device form validation errors
                      }
                    }}>
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10"
                          onClick={handleAddLocationClick}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Add New Location</DialogTitle>
                        </DialogHeader>
                        <Form {...locationForm}>
                          <form onSubmit={locationForm.handleSubmit((data) => addLocation.mutate(data))} className="space-y-4">
                            <FormField
                              control={locationForm.control}
                              name="LocationName"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Location Name</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder="Enter location name" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <Button
                              type="submit"
                              className="w-full"
                              disabled={addLocation.isPending}
                            >
                              {addLocation.isPending ? "Adding..." : "Add Location"}
                            </Button>
                          </form>
                        </Form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <Button type="submit" className="w-full" disabled={addDevice.isPending}>
                    {addDevice.isPending ? "Adding..." : "Add Device"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
          <Button onClick={refreshAllData} className="gap-2" disabled={isRefreshing}>
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>IP Address</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Version</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deviceListData?.SearchResult?.MatchList?.map(({ Device: device }) => {
              const details = deviceDetailsMap.get(device.devIndex);
              return (
                <TableRow key={device.devIndex}>
                  <TableCell className="font-medium">{device.devName}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      device.devStatus === 'online'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {device.devStatus}
                    </span>
                  </TableCell>
                  <TableCell>{device.devType}</TableCell>
                  <TableCell>{device.ISAPIParams.address}</TableCell>
                  <TableCell>{details?.DevLocationName ?? 'N/A'}</TableCell>
                  <TableCell>{device.devVersion || 'N/A'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Link to={`/devices/${device.devIndex}/employees`}>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Device</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete {device.devName}? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteDevice.mutate(device.devIndex)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}