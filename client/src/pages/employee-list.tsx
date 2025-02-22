import { useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RefreshCw, ArrowLeft, AlertCircle, Fingerprint, CreditCard, User, KeyRound, Check, X, UserPlus, Search, PowerOff } from "lucide-react";
import type { EmployeeListResponse, DeviceDetails, Employee, DeviceListResponse, Location } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { nanoid } from 'nanoid';

type VerificationMethods = {
  card: boolean;
  fingerprint: boolean;
  face: boolean;
  password: boolean;
};

const parseVerifyMode = (mode: string): VerificationMethods => {
  const methods = {
    card: false,
    fingerprint: false,
    face: false,
    password: false
  };

  const modeStr = mode.toLowerCase();

  methods.card = modeStr.includes('card');
  methods.fingerprint = modeStr.includes('fp');
  methods.face = modeStr.includes('face');
  methods.password = modeStr.includes('pw');

  return methods;
};

const currentYear = new Date().getFullYear();

export default function EmployeeList() {
  const [location] = useLocation();
  const deviceId = location.split('/')[2];
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModifying, setIsModifying] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [showEnableDialog, setShowEnableDialog] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [enableDate, setEnableDate] = useState<Date>();
  const [transferType, setTransferType] = useState<'Device' | 'Location'>('Device');
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [searchDevices, setSearchDevices] = useState('');
  const [searchLocations, setSearchLocations] = useState('');
  const { toast } = useToast();

  const { data: deviceDetails } = useQuery<DeviceDetails[]>({
    queryKey: ['/api/device-details']
  });

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['/api/locations/all']
  });

  const { data: devices } = useQuery<DeviceListResponse>({
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
      if (!response.ok) {
        throw new Error('Failed to fetch devices');
      }
      return response.json();
    }
  });

  const device = deviceDetails?.find(d => d.DevIndex === deviceId);

  const { data, isLoading, isError, error, refetch } = useQuery<EmployeeListResponse>({
    queryKey: ['/api/employees', deviceId],
    queryFn: async () => {
      console.log('Fetching employees for device:', deviceId);
      const response = await apiRequest('POST', `/api/employees/${deviceId}`, {
        UserInfoSearchCond: {
          searchID: nanoid(),
          searchResultPosition: 0,
          maxResults: 1000
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to fetch employees: ${response.status}`);
      }
      return response.json();
    },
    enabled: !!deviceId
  });

  const isValidityExpired = (endTime: string) => {
    const endDate = new Date(endTime);
    const now = new Date();
    return endDate < now;
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allEmployeeIds = filteredEmployees?.map(emp => emp.employeeNo) || [];
      setSelectedEmployees(allEmployeeIds);
    } else {
      setSelectedEmployees([]);
    }
  };

  const handleSelectEmployee = (employeeNo: string, checked: boolean) => {
    if (checked) {
      setSelectedEmployees(prev => [...prev, employeeNo]);
    } else {
      setSelectedEmployees(prev => prev.filter(id => id !== employeeNo));
    }
  };

  const handleTransfer = () => {
    setShowTransferDialog(true);
  };

  const handleTransferSubmit = async () => {
    setIsModifying(true);
    try {
      const employeesToTransfer = filteredEmployees?.filter(emp =>
        selectedEmployees.includes(emp.employeeNo)
      ) || [];

      let targetDevices: string[] = [];

      if (transferType === 'Device') {
        targetDevices = selectedDevices;
      } else {
        // For location transfer, get all devices in selected locations
        targetDevices = deviceDetails
          ?.filter(device =>
            selectedLocations.includes(device.DevLocation.toString()) &&
            device.DevIndex !== deviceId
          )
          .map(device => device.DevIndex) || [];
      }

      for (const deviceId of targetDevices) {
        const response = await apiRequest(
          'POST',
          `/api/devices/${deviceId}/transfer`,
          {
            UserInfo: employeesToTransfer.map(employee => ({
              employeeNo: employee.employeeNo,
              name: employee.name,
              userType: employee.userType,
              Valid: employee.Valid,
              password: employee.password,
              doorRight: employee.doorRight,
              RightPlan: employee.RightPlan,
              maxOpenDoorTime: employee.maxOpenDoorTime,
              openDoorTime: employee.openDoorTime,
              localUIRight: employee.localUIRight,
              userVerifyMode: employee.userVerifyMode,
              closeDelayEnabled: employee.closeDelayEnabled
            }))
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to transfer employees to device ${deviceId}`);
        }
      }

      toast({
        title: "Transfer successful",
        description: `Successfully transferred ${selectedEmployees.length} employee(s) to ${targetDevices.length} device(s)`,
      });

      setShowTransferDialog(false);
      setSelectedLocations([]);
      setSelectedDevices([]);
      setSelectedEmployees([]);
    } catch (error) {
      console.error('Error transferring employees:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to transfer employees",
      });
    } finally {
      setIsModifying(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisableEmployees = async (enable: boolean) => {
    setIsModifying(true);
    try {
      const currentTime = new Date();
      const monthAgoEnd = new Date(currentTime);
      monthAgoEnd.setMonth(monthAgoEnd.getMonth() - 1);
      monthAgoEnd.setHours(23, 59, 59);

      const endTime = enable
        ? (enableDate || new Date(currentTime.getFullYear() + 10, currentTime.getMonth(), currentTime.getDate(), 23, 59, 59))
        : monthAgoEnd;

      const employeesToModify = filteredEmployees?.filter(emp =>
        selectedEmployees.includes(emp.employeeNo)
      ) || [];

      for (const employee of employeesToModify) {
        await apiRequest('PUT', `/api/employees/${deviceId}/modify`, {
          UserInfo: {
            employeeNo: employee.employeeNo,
            name: employee.name,
            Valid: {
              beginTime: employee.Valid.beginTime,
              endTime: endTime.toISOString().replace('Z', ''),
              enable: true
            }
          }
        });
      }

      toast({
        title: `Successfully ${enable ? 'enabled' : 'disabled'} ${selectedEmployees.length} employee(s)`,
        description: "The employee list will refresh to show the updated status.",
      });

      await refetch();
      setSelectedEmployees([]);
      setShowDisableDialog(false);
      setShowEnableDialog(false);
      setEnableDate(undefined);
    } catch (error) {
      console.error('Error modifying employees:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to modify employees",
      });
    } finally {
      setIsModifying(false);
    }
  };

  const filteredEmployees = data?.UserInfoSearch?.UserInfo?.filter(employee => {
    const query = searchQuery.toLowerCase();
    return (
      employee.employeeNo.toLowerCase().includes(query) ||
      employee.name.toLowerCase().includes(query) ||
      employee.userType.toLowerCase().includes(query)
    );
  });

  const renderError = () => {
    const errorMessage = (error as Error)?.message || 'An unexpected error occurred';
    const is403Error = errorMessage.includes('403');

    return (
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8 max-w-[1400px]">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/devices">
            <Button variant="outline" size="icon" className="h-10 w-10">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">
            Employee List {device && `(${device.DevName})`}
          </h1>
        </div>

        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="ml-2">
            {is403Error
              ? "Unable to access employee data. Please check device permissions and try again."
              : `Failed to load employees: ${errorMessage}`
            }
          </AlertDescription>
        </Alert>

        <Button
          onClick={() => handleRefresh()}
          className="gap-2"
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Retrying...' : 'Retry'}
        </Button>
      </div>
    );
  };

  if (isError) {
    return renderError();
  }

  const handleSelectAllDevices = () => {
    if (devices) {
      const allDeviceIds = devices.SearchResult.MatchList
        .filter(({ Device }) => Device.devIndex !== deviceId)
        .map(({ Device }) => Device.devIndex);
      setSelectedDevices(prevSelected =>
        prevSelected.length === allDeviceIds.length ? [] : allDeviceIds
      );
    }
  };

  const handleSelectAllLocations = () => {
    if (locations) {
      const allLocationIds = locations.map(loc => loc.LocationCode.toString());
      setSelectedLocations(prevSelected =>
        prevSelected.length === allLocationIds.length ? [] : allLocationIds
      );
    }
  };

  const toggleDevice = (deviceId: string) => {
    setSelectedDevices(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  const toggleLocation = (locationId: string) => {
    setSelectedLocations(prev =>
      prev.includes(locationId)
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  return (
    <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8 max-w-[1400px]">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/devices">
          <Button variant="outline" size="icon" className="h-10 w-10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">
          Employee List {device && `(${device.DevName})`}
        </h1>
        <div className="flex-1" />
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {selectedEmployees.length > 0 && (
          <>
            <Button
              onClick={() => setShowEnableDialog(true)}
              className="gap-2"
              disabled={isModifying}
            >
              <PowerOff className="h-4 w-4" />
              Enable ({selectedEmployees.length})
            </Button>
            <Button
              onClick={() => setShowDisableDialog(true)}
              className="gap-2"
              variant="destructive"
              disabled={isModifying}
            >
              <PowerOff className="h-4 w-4" />
              Disable ({selectedEmployees.length})
            </Button>
          </>
        )}
        <Button
          onClick={() => handleTransfer()}
          className="gap-2"
          disabled={selectedEmployees.length === 0}
        >
          <UserPlus className="h-4 w-4" />
          Transfer ({selectedEmployees.length})
        </Button>
        <Button
          onClick={handleRefresh}
          className="gap-2"
          disabled={isRefreshing || isModifying}
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing || isModifying ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : isModifying ? 'Modifying...' : 'Refresh'}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <RefreshCw className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="bg-card rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={
                      filteredEmployees?.length > 0 &&
                      selectedEmployees.length === filteredEmployees?.length
                    }
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Employee No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>User Type</TableHead>
                <TableHead>Door Right</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <CreditCard className="w-4 h-4" />
                    Card
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Fingerprint className="w-4 h-4" />
                    Fingerprint
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <User className="w-4 h-4" />
                    Face
                  </div>
                </TableHead>
                <TableHead className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <KeyRound className="w-4 h-4" />
                    Password
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees?.map((employee) => {
                const verifyMethods = parseVerifyMode(employee.userVerifyMode);
                return (
                  <TableRow key={employee.employeeNo}>
                    <TableCell>
                      <Checkbox
                        checked={selectedEmployees.includes(employee.employeeNo)}
                        onCheckedChange={(checked) => handleSelectEmployee(employee.employeeNo, checked as boolean)}
                        aria-label={`Select employee ${employee.name}`}
                      />
                    </TableCell>
                    <TableCell>{employee.employeeNo}</TableCell>
                    <TableCell className="font-medium">{employee.name}</TableCell>
                    <TableCell>{employee.userType}</TableCell>
                    <TableCell>{employee.doorRight}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        isValidityExpired(employee.Valid.endTime)
                          ? 'bg-red-100 text-red-700'
                          : 'bg-green-100 text-green-700'
                      }`}>
                        {isValidityExpired(employee.Valid.endTime) ? 'Disabled' : 'Enabled'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {verifyMethods.card ? (
                        <Check className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {verifyMethods.fingerprint ? (
                        <Check className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {verifyMethods.face ? (
                        <Check className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {verifyMethods.password ? (
                        <Check className="w-4 h-4 text-green-600 mx-auto" />
                      ) : (
                        <X className="w-4 h-4 text-red-600 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Selected Employees</AlertDialogTitle>
            <AlertDialogDescription>
              This action will disable access for {selectedEmployees.length} selected employee(s).
              Their access will be revoked immediately. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDisableEmployees(false)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disable Employees
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showEnableDialog} onOpenChange={setShowEnableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Selected Employees</AlertDialogTitle>
            <AlertDialogDescription>
              Set an end date for the selected employees' access period.
              If no date is selected, access will be granted for 10 years by default.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !enableDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {enableDate ? format(enableDate, "PPP") : "Select end date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={enableDate}
                  onSelect={setEnableDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                  fromYear={currentYear}
                  toYear={currentYear + 10}
                  captionLayout="dropdown"
                />
              </PopoverContent>
            </Popover>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDisableEmployees(true)}
            >
              Enable Employees
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Biometric Data</DialogTitle>
            <DialogDescription>
              Transfer {selectedEmployees.length} selected employee(s) to another device or location.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="flex items-center gap-4">
              <span>Transfer to:</span>
              <div className="flex gap-4">
                <Button
                  variant={transferType === 'Device' ? 'default' : 'outline'}
                  onClick={() => setTransferType('Device')}
                >
                  Device
                </Button>
                <Button
                  variant={transferType === 'Location' ? 'default' : 'outline'}
                  onClick={() => setTransferType('Location')}
                >
                  Location
                </Button>
              </div>
            </div>

            {transferType === 'Device' ? (
              <div className="space-y-2">
                <Command className="rounded-lg border shadow-md">
                  <CommandInput
                    placeholder="Search devices..."
                    value={searchDevices}
                    onValueChange={setSearchDevices}
                  />
                  <CommandEmpty>No devices found.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-[200px]">
                      <CommandItem
                        onSelect={handleSelectAllDevices}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          checked={devices && selectedDevices.length === devices.SearchResult.MatchList.filter(
                            ({ Device }) => Device.devIndex !== deviceId
                          ).length && selectedDevices.length > 0}
                        />
                        <span>Select All</span>
                      </CommandItem>
                      {devices?.SearchResult.MatchList
                        .filter(({ Device }) => Device.devIndex !== deviceId)
                        .filter(({ Device }) =>
                          Device.devName.toLowerCase().includes(searchDevices.toLowerCase())
                        )
                        .map(({ Device }) => (
                          <CommandItem
                            key={Device.devIndex}
                            onSelect={() => toggleDevice(Device.devIndex)}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox checked={selectedDevices.includes(Device.devIndex)} />
                            <span>{Device.devName}</span>
                          </CommandItem>
                        ))}
                    </ScrollArea>
                  </CommandGroup>
                </Command>
                {selectedDevices.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Selected {selectedDevices.length} device(s)
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Command className="rounded-lg border shadow-md">
                  <CommandInput
                    placeholder="Search locations..."
                    value={searchLocations}
                    onValueChange={setSearchLocations}
                  />
                  <CommandEmpty>No locations found.</CommandEmpty>
                  <CommandGroup>
                    <ScrollArea className="h-[200px]">
                      <CommandItem
                        onSelect={handleSelectAllLocations}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          checked={locations && selectedLocations.length === locations.length && selectedLocations.length > 0}
                        />
                        <span>Select All</span>
                      </CommandItem>
                      {locations
                        ?.filter(location =>
                          location.LocationName.toLowerCase().includes(searchLocations.toLowerCase())
                        )
                        .map((location) => (
                          <CommandItem
                            key={location.LocationCode}
                            onSelect={() => toggleLocation(location.LocationCode.toString())}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox checked={selectedLocations.includes(location.LocationCode.toString())} />
                            <span>{location.LocationName}</span>
                          </CommandItem>
                        ))}
                    </ScrollArea>
                  </CommandGroup>
                </Command>
                {selectedLocations.length > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Selected {selectedLocations.length} location(s)
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowTransferDialog(false);
              setSelectedLocations([]);
              setSelectedDevices([]);
            }}>
              Cancel
            </Button>
            <Button
              onClick={handleTransferSubmit}
              disabled={
                isModifying ||
                (transferType === 'Device' && selectedDevices.length === 0) ||
                (transferType === 'Location' && selectedLocations.length === 0)
              }
            >
              Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}