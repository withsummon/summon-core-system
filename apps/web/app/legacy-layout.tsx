import { Outlet } from "react-router";
import { AppProvider } from "./provider";

export default function LegacyLayout() {
  return (
    <AppProvider>
      <Outlet />
    </AppProvider>
  );
}
