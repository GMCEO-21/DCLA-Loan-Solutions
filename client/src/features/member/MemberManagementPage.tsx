import { useState, useEffect, Suspense, lazy } from "react";
import { useQuery } from "react-query";
import {
  Box,
  Alert,
  Snackbar,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Pagination,
} from "@mui/material";
import PersonAdd from "@mui/icons-material/PersonAdd";
import DashboardLayout from "@components/layout/PrivateLayout";
import MemberCards from "./components/MemberCards";
import { useMembers } from "./hooks/useMember";
import type { Member, MemberFormData } from "./types";
import { CentersAPI } from "@features/centers/api";
import { centerKeys } from "@features/centers/hooks/useCenters";
import FullScreenLoader from "@components/common/FullScreenLoader";
import PageHeader from "@components/common/PageHeader";
import MemberLoadingSkeleton from "./components/MemberLoadingSkeleton";
import RequestErrorAlert from "@components/common/RequestErrorAlert";
import { useAuthStore } from "@features/auth/authStore";
import { canManageSavings } from "@features/auth/access";
import { getApiErrorMessage } from "@utils/apiError";

const MemberModal = lazy(() => import("./components/MemberModal"));
const LoanModal = lazy(() => import("@features/loans/components/LoanModal"));
const SavingsDepositDialog = lazy(
  () => import("@features/savings/components/SavingsDepositDialog"),
);

export default function MembersPage() {
  const role = useAuthStore((state) => state.user?.role ?? "");
  const savingsActionsAllowed = canManageSavings(role);
  const [selectedCenterId, setSelectedCenterId] = useState<string>("");
  const [searchMember, setSearchMember] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const {
    members,
    total,
    page,
    limit,
    setPage,
    loading,
    error,
    createMember,
    updateMember,
    deleteMember,
    refetch,
  } = useMembers({
    search: debouncedSearch || undefined,
    centerId: selectedCenterId || undefined,
  });
  const centersQuery = useQuery(
    centerKeys.options,
    ({ signal }) => CentersAPI.getOptions(signal),
    { staleTime: 5 * 60_000 },
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | undefined>(
    undefined,
  );
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [loanModalOpen, setLoanModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [savingsDialogOpen, setSavingsDialogOpen] = useState(false);
  const [savingsMember, setSavingsMember] = useState<Member | null>(null);
  const centers = centersQuery.data ?? [];
  const centersError = centersQuery.error
    ? `Center filters are unavailable. ${getApiErrorMessage(centersQuery.error)}`
    : null;

  useEffect(() => {
    setPage(1);
    const timer = setTimeout(
      () => setDebouncedSearch(searchMember.trim()),
      300,
    );
    return () => clearTimeout(timer);
  }, [searchMember, setPage]);

  const handleCenterFilterChange = (centerId: string) => {
    setSelectedCenterId(centerId);
    setPage(1);
  };

  const showSnackbar = (
    message: string,
    severity: "success" | "error" = "success",
  ) => {
    setSnackbar({ open: true, message, severity });
  };

  const handleOpenModal = () => {
    setEditingMember(undefined);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditingMember(undefined);
  };

  const handleFormSubmit = async (data: MemberFormData) => {
    try {
      if (editingMember) {
        await updateMember(editingMember.id, data);
        showSnackbar("Member updated successfully!");
      } else {
        await createMember(data);
        showSnackbar("Member created successfully!");
      }
    } catch (err) {
      console.error("Failed to save member:", err);
      showSnackbar(getApiErrorMessage(err), "error");
      throw err;
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMember(id);
      showSnackbar("Member deleted successfully!");
    } catch (err) {
      console.error("Failed to delete member:", err);
      showSnackbar(getApiErrorMessage(err), "error");
      throw err;
    }
  };

  const handleCloseSnackbar = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleViewLoan = (member: Member) => {
    setSelectedMember(member);
    setLoanModalOpen(true);
  };

  const handleOpenSavingsDialog = (member: Member) => {
    setSavingsMember(member);
    setSavingsDialogOpen(true);
  };

  const handleCloseLoanModal = () => {
    setLoanModalOpen(false);
    setSelectedMember(null);
  };

  const handleCloseSavingsDialog = () => {
    setSavingsDialogOpen(false);
    setSavingsMember(null);
  };

  const handleLoanCreated = () => {
    showSnackbar("Loan created successfully!");
  };

  const formatCurrency = (amount: number): string =>
    `₱${Number(amount || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const handleSavingsSuccess = async () => {
    await refetch();
    showSnackbar("Savings deposit recorded!");
    handleCloseSavingsDialog();
  };

  // Use server-side filtered results directly
  const filteredMembers = members;

  if (loading && filteredMembers.length === 0) {
    return (
      <DashboardLayout>
        <MemberLoadingSkeleton count={limit} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Box
        sx={{
          minWidth: 0,
          maxWidth: "100%",
        }}
      >
        {/* Header Section */}
        <PageHeader
          title="Members"
          description="Manage member records and lending information."
          actions={
            <Button
              variant="contained"
              startIcon={<PersonAdd />}
              onClick={handleOpenModal}
            >
              Add Member
            </Button>
          }
        />
        <Box
          role="group"
          aria-label="Member filters"
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
          <FormControl
            size="small"
            sx={{
              minWidth: 0,
              width: { xs: "100%", sm: 260 },
              "& .MuiOutlinedInput-root": { minHeight: 44 },
            }}
          >
            <InputLabel id="member-center-filter-label">Center</InputLabel>
            <Select
              labelId="member-center-filter-label"
              value={selectedCenterId}
              label="Center"
              onChange={(e) => handleCenterFilterChange(e.target.value)}
              MenuProps={{
                anchorOrigin: {
                  vertical: "bottom",
                  horizontal: "left",
                },
                transformOrigin: {
                  vertical: "top",
                  horizontal: "left",
                },
                PaperProps: {
                  sx: {
                    maxHeight: { xs: 280, sm: 320 },
                    maxWidth: "calc(100vw - 32px)",
                    overflowY: "auto",
                    "& .MuiMenuItem-root": {
                      whiteSpace: "normal",
                      overflowWrap: "anywhere",
                      minHeight: 44,
                    },
                  },
                },
              }}
              sx={{
                backgroundColor: "white",
                borderRadius: 2,
              }}
            >
              <MenuItem value="">All Centers</MenuItem>
              {centers.map((center) => (
                <MenuItem key={center.id} value={center.id}>
                  {center.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            size="small"
            label="Search members"
            placeholder="Search by name"
            value={searchMember}
            onChange={(e) => setSearchMember(e.target.value)}
            sx={{
              minWidth: 0,
              flex: 1,
              maxWidth: { sm: 480 },
              "& .MuiOutlinedInput-root": {
                minHeight: 44,
                backgroundColor: "white",
                borderRadius: 2,
              },
            }}
          />
        </Box>
        {/* Error Alert */}
        {error && (
          <RequestErrorAlert message={error} onRetry={() => refetch()} />
        )}
        {centersError && (
          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
            {centersError}
          </Alert>
        )}

        {/* Members Cards */}
        <MemberCards
          members={filteredMembers}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onViewLoan={handleViewLoan}
          onAddSavings={
            savingsActionsAllowed ? handleOpenSavingsDialog : undefined
          }
          loading={loading}
        />

        {/* Pagination Controls */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            mt: 3,
            pt: 2,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Pagination
            count={Math.ceil(total / limit) || 1}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
            sx={{
              "& .MuiPagination-ul": { justifyContent: "center", rowGap: 1 },
              "& .MuiPaginationItem-root": { minHeight: 44 },
            }}
          />
        </Box>

        {/* Member Modal */}
        {modalOpen && (
          <Suspense fallback={<FullScreenLoader />}>
            <MemberModal
              open
              member={editingMember}
              onClose={handleCloseModal}
              onSubmit={handleFormSubmit}
              loading={loading}
            />
          </Suspense>
        )}

        {/* Loan Modal */}
        {selectedMember && (
          <Suspense fallback={<FullScreenLoader />}>
            <LoanModal
              open={loanModalOpen}
              member={selectedMember}
              onClose={handleCloseLoanModal}
              onLoanCreated={handleLoanCreated}
            />
          </Suspense>
        )}

        {/* Savings Deposit Dialog */}
        {savingsDialogOpen && (
          <Suspense fallback={<FullScreenLoader />}>
            <SavingsDepositDialog
              open
              member={savingsMember}
              onClose={handleCloseSavingsDialog}
              onSuccess={handleSavingsSuccess}
              formatCurrency={formatCurrency}
            />
          </Suspense>
        )}

        {/* Success/Error Snackbar */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={4000}
          onClose={handleCloseSnackbar}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            onClose={handleCloseSnackbar}
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
