import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Devices from "@/pages/devices";
import EmployeeList from "@/pages/employee-list";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Devices} />
      <Route path="/devices" component={Devices} />
      <Route path="/home" component={Home} />
      <Route path="/devices/:id/employees" component={EmployeeList} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;