import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useToast } from "../context/ToastContext";

/**
 * useAction(fn, { success, invalidate, onSuccess }) – a mutation that shows a
 * toast on success/error and invalidates the given query key prefixes.
 */
export function useAction(fn, { success, invalidate = [], onSuccess, onError } = {}) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: k })));
      if (success) toast.success(typeof success === "function" ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (err) => {
      toast.error(err);
      onError?.(err);
    },
  });
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Simple controlled-form state helper. */
export function useForm(initial) {
  const [values, setValues] = useState(initial);
  const bind = (name, { type } = {}) => ({
    name,
    value: type === "checkbox" ? undefined : values[name] ?? "",
    checked: type === "checkbox" ? Boolean(values[name]) : undefined,
    onChange: (e) => {
      const v = e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
      setValues((s) => ({ ...s, [name]: v }));
    },
  });
  return { values, setValues, bind, set: (k, v) => setValues((s) => ({ ...s, [k]: v })) };
}
