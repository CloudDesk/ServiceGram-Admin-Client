import { zodResolver } from "@hookform/resolvers/zod";
import { LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { InlineAlert } from "../../../components/feedback/InlineAlert";
import { Input } from "../../../components/ui/Input";
import { FormErrorSummary } from "../../../components/feedback/FormErrorSummary";
import { routePaths } from "../../../config/routes";
import { useToast } from "../../../hooks/useToast";
import { storageKeys } from "../../../lib/storage";
import { safeJsonParse } from "../../../utils/safeJson";
import { PasswordInput } from "./PasswordInput";
import { useLogin } from "../hooks/useLogin";
import { LoginServiceError } from "../types/auth.types";
import { type LoginFormValues, loginSchema } from "../schemas/auth.schema";
import { getAdminDeviceId } from "../utils/device";
import { safeAuthRedirectPath } from "../utils/redirect";

const EMPTY_LOGIN_VALUES: LoginFormValues = {
  email: "",
  password: "",
};

interface LoginLocationState {
  from?: {
    hash?: string
    pathname?: string
    search?: string
  }
}

interface AuthRedirectNotice {
  message: string
  reason: "expired" | "reauth"
  redirectTo: string
}

function hasFieldErrors(details: unknown): details is {
  fieldErrors: {
    field: string;
    code: string;
    message: string;
  }[];
} {
  return Boolean(
    details &&
    typeof details === "object" &&
    "fieldErrors" in details &&
    Array.isArray((details as { fieldErrors?: unknown }).fieldErrors),
  );
}

function redirectFromLocationState(state: unknown) {
  const locationState = state as LoginLocationState | null;
  const from = locationState?.from;

  if (!from?.pathname) {
    return null;
  }

  return `${from.pathname}${from.search ?? ""}${from.hash ?? ""}`;
}

function readAuthRedirectNotice() {
  return safeJsonParse<AuthRedirectNotice | null>(
    window.sessionStorage.getItem(storageKeys.authRedirectNotice),
    null,
  );
}

export function LoginForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { pushToast } = useToast();
  const mutation = useLogin();
  const redirectNotice = useMemo(readAuthRedirectNotice, []);
  const redirectTo = safeAuthRedirectPath(
    searchParams.get("redirectTo") ??
      redirectNotice?.redirectTo ??
      redirectFromLocationState(location.state),
  );
  const reason = searchParams.get("reason") ?? redirectNotice?.reason;
  const noticeMessage =
    reason === "reauth"
      ? redirectNotice?.message ??
        "Please sign in again before performing this action."
      : reason === "expired"
        ? redirectNotice?.message ??
          "Your session has expired. Please log in again."
        : null;
  const {
    clearErrors,
    formState: { errors },
    handleSubmit,
    register,
    reset,
    setError,
    setValue,
    watch,
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: EMPTY_LOGIN_VALUES,
  });
  const emailField = register("email");

  useEffect(() => {
    reset(EMPTY_LOGIN_VALUES);
  }, [reset]);

  function clearLoginFeedback(field: keyof LoginFormValues) {
    clearErrors(field);

    if (mutation.error) {
      mutation.reset();
    }
  }

  return (
    <form
      autoComplete="on"
      className="relative z-10 space-y-4"
      onSubmit={handleSubmit(async (values) => {
        try {
          await mutation.mutateAsync({
            ...values,
            deviceId: getAdminDeviceId(),
          });

          pushToast({
            tone: "success",
            title: "Signed in successfully.",
            description:
              redirectTo === routePaths.dashboard
                ? "Loading your admin workspace."
                : "Returning you to your previous page.",
          });
          window.sessionStorage.removeItem(storageKeys.authRedirectNotice);
          navigate(redirectTo, { replace: true });
        } catch (error) {
          if (error instanceof LoginServiceError) {
            if (error.status === 400) {
              const details = error.response?.details;

              if (hasFieldErrors(details)) {
                details.fieldErrors.forEach((fieldError) => {
                  if (
                    fieldError.field === "email" ||
                    fieldError.field === "password"
                  ) {
                    setError(fieldError.field, {
                      type: fieldError.code,
                      message: fieldError.message,
                    });
                  }
                });
              }

              return;
            }

            if (error.status === 401) {
              pushToast({
                tone: "danger",
                title: "Login failed.",
                description:
                  error.response?.message ?? "Invalid email or password.",
              });
            }

            return;
          }

          pushToast({
            tone: "danger",
            title: "Login failed.",
            description: "Please try again in a moment.",
          });
        }
      })}
    >
      <div className="space-y-2">
        <h1 className="text-[1.9rem] font-semibold tracking-[-0.05em] text-foreground">
          Welcome back
        </h1>
      </div>

      {noticeMessage ? <InlineAlert message={noticeMessage} /> : null}

      <div className="space-y-2">
        <label
          className="text-[0.8125rem] font-bold tracking-[0.01em] text-foreground"
          htmlFor="email"
        >
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            autoComplete="username"
            className="min-h-12 rounded-[1.125rem] border-border bg-surface/80 pl-11 text-[0.9375rem] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-muted focus-visible:border-foreground/20 focus-visible:bg-surface focus-visible:ring-foreground/10"
            hasError={Boolean(errors.email)}
            id="email"
            placeholder="admin@servicegram.in"
            {...emailField}
            onChange={(event) => {
              clearLoginFeedback("email");
              void emailField.onChange(event);
            }}
          />
        </div>
        <FormErrorSummary message={errors.email?.message} />
      </div>

      <div className="space-y-2">
        <label
          className="text-[0.8125rem] font-bold tracking-[0.01em] text-foreground"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 z-10 size-4 -translate-y-1/2 text-muted" />
          <PasswordInput
            autoComplete="current-password"
            hasError={Boolean(errors.password)}
            id="password"
            inputClassName="min-h-12 rounded-[1.125rem] border-border bg-surface/80 pl-11 text-[0.9375rem] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] placeholder:text-muted focus-visible:border-foreground/20 focus-visible:bg-surface focus-visible:ring-foreground/10"
            name="password"
            onBlur={() => undefined}
            onChange={(value) => {
              clearLoginFeedback("password");
              setValue("password", value, {
                shouldDirty: true,
                shouldValidate: true,
              });
            }}
            placeholder="Enter your password"
            value={watch("password")}
          />
        </div>
        <FormErrorSummary message={errors.password?.message} />
      </div>

      <FormErrorSummary message={mutation.error?.message} />

      <div className="flex justify-end text-[0.8125rem] text-muted">
        <Link
          className="font-bold text-foreground transition hover:text-muted"
          to={routePaths.forgotPassword}
        >
          Forgot password?
        </Link>
      </div>

      <Button
        className="min-h-[3.25rem] w-full rounded-[1.2rem] bg-foreground text-[0.9375rem] font-extrabold text-primary-foreground shadow-[0_20px_45px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.2)] transition duration-200 hover:-translate-y-0.5 hover:bg-sidebar hover:shadow-[0_26px_60px_rgba(15,23,42,0.28),inset_0_1px_0_rgba(255,255,255,0.24)]"
        isLoading={mutation.isPending}
        type="submit"
        variant="ghost"
      >
        Sign in to Admin Portal
      </Button>

      <div className="rounded-[1.25rem] border border-border/70 bg-surface/60 p-3 text-[0.8125rem] leading-5 text-muted">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-foreground" />
          <p>
            Secured with encrypted sessions, role-based access, audit logs and
            admin-level verification.
          </p>
        </div>
      </div>
    </form>
  );
}
