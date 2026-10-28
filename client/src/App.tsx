import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { BrowserRouter } from "react-router-dom";
import { theme } from "./theme/theme";
import DashboardPage from "./features/dashboard/pages/DashboardPage";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        {/* Your routing logic here */}
        <DashboardPage />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
