import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/** Konfirmasi hapus source memakai dialog aplikasi, bukan confirm() bawaan browser. */
export function DeleteSourceDialog({
  running,
  onConfirm,
  disabled,
  trigger,
}: {
  running: boolean;
  onConfirm: () => void;
  disabled?: boolean;
  trigger?: ReactNode;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? (
          <Button variant="ghost" size="icon" disabled={disabled} aria-label="Hapus source">
            <Trash2 className="size-4" />
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus Source Video?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              Source ini sedang memiliki data analisis. Jika dihapus, transcript, OCR, snapshot,
              scene analysis, Viral DNA, dan hasil ATM akan ikut terhapus.
            </span>
            {running ? (
              <span className="block font-medium text-destructive">
                Source sedang diproses. Menghapus akan membatalkan proses analisis berjalan.
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Ya, Hapus Source</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
