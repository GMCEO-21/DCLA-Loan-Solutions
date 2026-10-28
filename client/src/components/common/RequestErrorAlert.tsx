import { Alert, Button } from "@mui/material";

type RequestErrorAlertProps = {
  message: string;
  onRetry?: () => void;
};

export default function RequestErrorAlert({
  message,
  onRetry,
}: RequestErrorAlertProps) {
  return (
    <Alert
      severity="error"
      role="alert"
      sx={{ mb: 3, borderRadius: 2, overflowWrap: "anywhere" }}
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      {message}
    </Alert>
  );
}
