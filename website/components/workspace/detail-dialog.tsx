"use client";

import type { ReactNode } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type DetailDialogProps = {
  trigger: ReactNode;
  title: string;
  description?: string;
  children: ReactNode;
  contentClassName?: string;
};

export function DetailDialog(props: DetailDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>{props.trigger}</DialogTrigger>
      <DialogContent className={props.contentClassName ?? "max-w-3xl border-border/70 bg-card/95"}>
        <DialogHeader>
          <DialogTitle>{props.title}</DialogTitle>
          {props.description ? <DialogDescription>{props.description}</DialogDescription> : null}
        </DialogHeader>
        {props.children}
      </DialogContent>
    </Dialog>
  );
}

