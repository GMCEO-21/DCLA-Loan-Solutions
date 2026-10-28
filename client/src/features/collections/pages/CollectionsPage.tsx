import type React from "react";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  InputAdornment,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import CalendarMonth from "@mui/icons-material/CalendarMonth";
import Groups from "@mui/icons-material/Groups";
import Refresh from "@mui/icons-material/Refresh";
import Search from "@mui/icons-material/Search";
import PageHeader from "@components/common/PageHeader";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import DashboardLayout from "@components/layout/PrivateLayout";
import { getApiErrorMessage } from "@utils/apiError";
import CollectionDetailsModal from "../components/CollectionDetailsModal";
import CollectionsLoadingSkeleton, {
  CollectionsTabLoadingSkeleton,
} from "../components/CollectionsLoadingSkeleton";
import CollectionUpdateModal from "../components/CollectionUpdateModal";
import DailyCollectionsView from "../components/DailyCollectionsView";
import { useCollections } from "../hooks/useCollections";
import type { Collection, DailyCollectionGroup } from "../types";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={"collections-tabpanel-" + index}
      aria-labelledby={"collections-tab-" + index}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>{children}</Box>
      )}
    </div>
  );
}

function TabLabel({
  icon,
  label,
  count,
  countLabel,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  countLabel: string;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        whiteSpace: "nowrap",
      }}
    >
      {icon}
      <span>{label}</span>
      {count !== undefined && (
        <Box
          component="span"
          aria-label={count + " " + countLabel}
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 24,
            height: 24,
            px: 0.75,
            borderRadius: 1,
            bgcolor: "action.selected",
            color: "primary.main",
            fontSize: "0.75rem",
            fontWeight: 700,
          }}
        >
          {count}
        </Box>
      )}
    </Box>
  );
}

export default function CollectionsPage() {
  const [tabValue, setTabValue] = useState<0 | 1>(0);
  const {
    dailyCollections,
    allCollections,
    dailyHasData,
    allHasData,
    loading,
    loadingDaily,
    loadingAll,
    errors,
    updateCollection,
    refetchDaily,
    refetchAll,
    search,
    setSearch,
    dailyDate,
    allDate,
    setAllDate,
    syncDailyDate,
  } = useCollections(tabValue);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [updateModalOpen, setUpdateModalOpen] = useState(false);
  const [selectedCollectionGroup, setSelectedCollectionGroup] = useState<
    DailyCollectionGroup | undefined
  >();
  const [selectedCollection, setSelectedCollection] = useState<
    Collection | undefined
  >();
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const showSnackbar = (
    message: string,
    severity: "success" | "error" = "success",
  ) => setSnackbar({ open: true, message, severity });

  const handleTabChange = (_event: React.SyntheticEvent, newValue: 0 | 1) => {
    if (newValue === 0) syncDailyDate();
    setTabValue(newValue);
  };

  const handleViewDetails = (group: DailyCollectionGroup) => {
    setSelectedCollectionGroup(group);
    setDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setDetailsModalOpen(false);
    setSelectedCollectionGroup(undefined);
  };

  const handleEditCollection = (collection: Collection) => {
    setSelectedCollection(collection);
    setUpdateModalOpen(true);
  };

  const handleCloseUpdateModal = () => {
    setUpdateModalOpen(false);
    setSelectedCollection(undefined);
  };

  const handleUpdateCollection = async (
    id: string,
    data: { paymentReceived: number; notes?: string },
  ) => {
    try {
      await updateCollection(id, data);
      showSnackbar("Collection updated successfully!");
    } catch (err) {
      console.error("Failed to update collection", err);
      showSnackbar(getApiErrorMessage(err), "error");
      throw err;
    }
  };

  const handleRefresh = async () => {
    try {
      await (tabValue === 0 ? refetchDaily() : refetchAll());
      showSnackbar("Data refreshed successfully!");
    } catch (err) {
      console.error("Failed to refresh collections", err);
      showSnackbar(getApiErrorMessage(err), "error");
    }
  };

  const handleDateChange = (value: string) => {
    if (value) setAllDate(value);
  };

  if (loading && dailyCollections.length === 0 && allCollections.length === 0) {
    return (
      <DashboardLayout>
        <CollectionsLoadingSkeleton />
      </DashboardLayout>
    );
  }

  const activeError = tabValue === 0 ? errors.daily : errors.all;

  return (
    <DashboardLayout>
      <Box sx={{ minWidth: 0, maxWidth: "100%" }}>
        <PageHeader
          title="Collections"
          description="Manage scheduled collections and repayments."
          actions={
            <Button
              variant="contained"
              startIcon={<Refresh />}
              onClick={handleRefresh}
            >
              Refresh Data
            </Button>
          }
        />

        <Box
          role="group"
          aria-label="Collection filters"
          sx={{
            display: "flex",
            alignItems: "stretch",
            flexDirection: { xs: "column", sm: "row" },
            gap: 2,
            mb: 3,
            pb: 3,
            borderBottom: "1px solid",
            borderColor: "divider",
            minWidth: 0,
          }}
        >
          <TextField
            size="small"
            label="Search centers"
            placeholder="Search by center name"
            value={search || ""}
            onChange={(event) => setSearch(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              maxWidth: { sm: 480 },
              "& .MuiOutlinedInput-root": {
                minHeight: 44,
                bgcolor: "background.paper",
              },
            }}
          />

          {tabValue === 1 && (
            <TextField
              size="small"
              type="date"
              label="Collection date"
              value={allDate}
              onChange={(event) => handleDateChange(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{
                width: { xs: "100%", sm: 180 },
                "& .MuiOutlinedInput-root": {
                  minHeight: 44,
                  bgcolor: "background.paper",
                },
              }}
            />
          )}
        </Box>

        {activeError && (
          <RequestErrorAlert
            message={activeError}
            onRetry={tabValue === 0 ? refetchDaily : refetchAll}
          />
        )}
        {errors.update && <RequestErrorAlert message={errors.update} />}

        <Paper
          elevation={0}
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            overflow: "hidden",
          }}
        >
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            variant="scrollable"
            scrollButtons="auto"
            allowScrollButtonsMobile
            aria-label="Collection views"
            sx={{
              px: { xs: 0.5, sm: 2 },
              borderBottom: "1px solid",
              borderColor: "divider",
              minHeight: 56,
              "& .MuiTab-root": {
                minHeight: 56,
                minWidth: "auto",
                px: { xs: 1.5, sm: 2 },
                textTransform: "none",
                fontWeight: 600,
                color: "text.secondary",
              },
              "& .Mui-selected": { color: "primary.main" },
              "& .MuiTabs-indicator": { height: 3 },
            }}
          >
            <Tab
              id="collections-tab-0"
              aria-controls="collections-tabpanel-0"
              label={
                <TabLabel
                  icon={<Groups fontSize="small" />}
                  label="Daily Collections"
                  count={dailyHasData ? dailyCollections.length : undefined}
                  countLabel="scheduled collection centers"
                />
              }
            />
            <Tab
              id="collections-tab-1"
              aria-controls="collections-tabpanel-1"
              label={
                <TabLabel
                  icon={<CalendarMonth fontSize="small" />}
                  label="Collections by Date"
                  count={allHasData ? allCollections.length : undefined}
                  countLabel="collection centers for selected date"
                />
              }
            />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {errors.daily && !dailyHasData ? null : loadingDaily &&
              dailyCollections.length === 0 ? (
              <CollectionsTabLoadingSkeleton />
            ) : dailyCollections.length === 0 && search ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography variant="h6" gutterBottom>
                  No centers found matching "{search}"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search terms or check for typos.
                </Typography>
              </Box>
            ) : (
              <DailyCollectionsView
                data={dailyCollections}
                onViewDetails={handleViewDetails}
                loading={loading}
                datasetDate={dailyDate}
                isDaily
              />
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {errors.all && !allHasData ? null : loadingAll &&
              allCollections.length === 0 ? (
              <CollectionsTabLoadingSkeleton />
            ) : allCollections.length === 0 && search ? (
              <Box sx={{ py: 6, textAlign: "center" }}>
                <Typography variant="h6" gutterBottom>
                  No centers found matching "{search}"
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try adjusting your search terms or check for typos.
                </Typography>
              </Box>
            ) : (
              <DailyCollectionsView
                data={allCollections}
                onViewDetails={handleViewDetails}
                loading={loading}
                datasetDate={allDate}
              />
            )}
          </TabPanel>
        </Paper>

        <CollectionDetailsModal
          open={detailsModalOpen}
          collectionGroup={selectedCollectionGroup}
          onClose={handleCloseDetailsModal}
          onDataChanged={async () => {
            try {
              await (tabValue === 0 ? refetchDaily() : refetchAll());
            } catch (error) {
              console.warn("Failed to refresh collections", error);
            }
          }}
          onEditCollection={handleEditCollection}
        />

        <CollectionUpdateModal
          open={updateModalOpen}
          collection={selectedCollection}
          onClose={handleCloseUpdateModal}
          onSubmit={handleUpdateCollection}
          loading={loading}
        />

        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={() =>
            setSnackbar((previous) => ({ ...previous, open: false }))
          }
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={() =>
              setSnackbar((previous) => ({ ...previous, open: false }))
            }
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </DashboardLayout>
  );
}
