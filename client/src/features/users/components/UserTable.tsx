import type { ReactNode } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import Block from "@mui/icons-material/Block";
import CheckCircle from "@mui/icons-material/CheckCircle";
import Edit from "@mui/icons-material/Edit";
import LockReset from "@mui/icons-material/LockReset";
import type { AdminUser } from "../types";

interface UserTableProps {
  users: AdminUser[];
  loading?: boolean;
  currentUserId?: string;
  filtered?: boolean;
  onEdit: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onToggleStatus: (user: AdminUser) => void;
}

export default function UserTable({
  users,
  loading = false,
  currentUserId,
  filtered = false,
  onEdit,
  onResetPassword,
  onToggleStatus,
}: UserTableProps) {
  let content: ReactNode;

  if (loading && users.length === 0) {
    content = (
      <Box
        role="status"
        sx={{ py: 8, px: 2, textAlign: "center", color: "text.secondary" }}
      >
        <CircularProgress size={32} />
        <Typography variant="body2" sx={{ mt: 2 }}>
          Loading users...
        </Typography>
      </Box>
    );
  } else if (users.length === 0) {
    content = (
      <Box sx={{ py: 8, px: 2, textAlign: "center" }}>
        <Typography variant="h6">
          {filtered ? "No matching users" : "No users found"}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {filtered
            ? "No user records match the current search."
            : "Create a user to get started."}
        </Typography>
      </Box>
    );
  } else {
    content = (
      <TableContainer sx={{ maxWidth: "100%", overflowX: "auto" }}>
        <Table sx={{ minWidth: 760 }} aria-label="System users">
          <TableHead>
            <TableRow sx={{ bgcolor: "background.default" }}>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users.map((user) => {
              const name =
                [user.firstName, user.middleName, user.lastName]
                  .filter(Boolean)
                  .join(" ") || "Unnamed user";
              const isSelf = currentUserId === user.id;
              const isSuperAdmin = user.role === "superadmin";
              const statusAction = user.isActive ? "Deactivate" : "Reactivate";

              return (
                <TableRow
                  key={user.id}
                  hover
                  sx={{
                    "&:last-child td": { borderBottom: 0 },
                    "&:hover": { bgcolor: "action.hover" },
                  }}
                >
                  <TableCell sx={{ minWidth: 180 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {name}
                    </Typography>
                  </TableCell>
                  <TableCell sx={{ minWidth: 220 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ overflowWrap: "anywhere" }}
                    >
                      {user.email}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.role}
                      size="small"
                      variant="outlined"
                      sx={{
                        textTransform: "capitalize",
                        color: "text.primary",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.isActive ? "Active" : "Inactive"}
                      size="small"
                      color={user.isActive ? "success" : "default"}
                      variant={user.isActive ? "outlined" : "filled"}
                      sx={{ fontWeight: 600 }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: 0.5,
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Tooltip
                        title={
                          isSuperAdmin
                            ? "Superadmin account cannot be edited here"
                            : "Edit user"
                        }
                      >
                        <span>
                          <IconButton
                            aria-label={`Edit ${name}`}
                            onClick={() => onEdit(user)}
                            disabled={isSuperAdmin}
                            sx={{
                              width: 44,
                              height: 44,
                              color: "primary.main",
                            }}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip
                        title={
                          isSuperAdmin
                            ? "Superadmin password cannot be reset here"
                            : "Reset password"
                        }
                      >
                        <span>
                          <IconButton
                            aria-label={`Reset password for ${name}`}
                            onClick={() => onResetPassword(user)}
                            disabled={isSuperAdmin}
                            sx={{
                              width: 44,
                              height: 44,
                              color: "warning.dark",
                            }}
                          >
                            <LockReset fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip
                        title={
                          isSuperAdmin
                            ? "Superadmin account status cannot be changed here"
                            : isSelf
                              ? "You cannot deactivate your own account"
                              : `${statusAction} user`
                        }
                      >
                        <span>
                          <IconButton
                            aria-label={`${statusAction} ${name}`}
                            onClick={() => onToggleStatus(user)}
                            disabled={isSuperAdmin || isSelf}
                            sx={{
                              width: 44,
                              height: 44,
                              color: user.isActive
                                ? "error.main"
                                : "success.dark",
                            }}
                          >
                            {user.isActive ? (
                              <Block fontSize="small" />
                            ) : (
                              <CheckCircle fontSize="small" />
                            )}
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    );
  }

  return (
    <Paper
      elevation={0}
      sx={{
        minWidth: 0,
        maxWidth: "100%",
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: "background.paper",
      }}
    >
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Typography variant="h6">Users list</Typography>
      </Box>
      {content}
    </Paper>
  );
}
