"use client";

import { cn } from "@/lib/utils";
import { Link, LinkProps } from "react-router-dom";
import React, { useState, createContext, useContext } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ChevronLeft } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => {
  return (
    <>
      <DesktopSidebar className={className}>{children}</DesktopSidebar>
      <MobileSidebar className={className}>{children}</MobileSidebar>
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <div className="relative h-full flex-shrink-0 hidden md:block">
      <motion.div
        className={cn(
          "h-full px-4 py-4 hidden md:flex md:flex-col w-[260px]",
          className
        )}
        animate={{
          width: animate ? (open ? "260px" : "76px") : "260px",
        }}
        transition={{
          duration: 0.3,
          ease: "easeInOut",
        }}
        {...props}
      >
        {children}
      </motion.div>
      
      {/* Toggle Button - outside motion.div to avoid type issues */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 
                   bg-slate-800 border border-slate-700 rounded-full 
                   hidden md:flex items-center justify-center
                   hover:bg-slate-700 hover:border-cyan-500/50 
                   transition-all shadow-lg z-50 group"
      >
        <ChevronLeft 
          className={cn(
            "w-4 h-4 text-slate-400 group-hover:text-cyan-400 transition-all duration-300",
            !open && "rotate-180"
          )} 
        />
      </button>
    </div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      {/* Mobile TopBar */}
      <div
        className={cn(
          "h-14 px-4 pt-safe flex flex-row md:hidden items-center justify-between bg-slate-950/90 backdrop-blur-xl w-full border-b border-slate-800/50 sticky top-0 z-30 shrink-0"
        )}
        {...props}
      >
        <button
          type="button"
          aria-label="Abrir menu"
          onClick={() => setOpen(!open)}
          className="inline-flex items-center justify-center w-10 h-10 -ml-2 rounded-lg text-slate-200 hover:text-cyan-400 hover:bg-slate-800/60 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-sm font-semibold tracking-tight text-foreground">Iris</div>
        <div className="w-10 h-10" />
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 bg-black/60 z-[90]"
                onClick={() => setOpen(false)}
              />
              <motion.div
                initial={{ x: "-100%", opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: "-100%", opacity: 0 }}
                transition={{
                  duration: 0.25,
                  ease: "easeInOut",
                }}
                className={cn(
                  "fixed top-0 left-0 h-[100dvh] w-[85%] max-w-[320px] bg-slate-950 px-5 pt-safe pb-safe z-[100] flex flex-col overflow-y-auto border-r border-slate-800/60 shadow-2xl",
                  className
                )}
              >
                <div
                  className="absolute right-3 top-3 z-50 p-2 rounded-lg text-slate-300 cursor-pointer hover:text-cyan-400 hover:bg-slate-800/60 transition-colors"
                  onClick={() => setOpen(false)}
                >
                  <X className="w-5 h-5" />
                </div>
                <div className="pt-4">{children}</div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  isActive,
  onClick,
  ...props
}: {
  link: Links;
  className?: string;
  isActive?: boolean;
  onClick?: () => void;
  props?: Omit<LinkProps, 'to'>;
}) => {
  const { open, animate } = useSidebar();
  return (
    <Link
      to={link.href}
      onClick={onClick}
      className={cn(
        "flex items-center justify-start gap-3 group/sidebar py-3 px-3 rounded-xl transition-all duration-200 relative overflow-hidden",
        isActive
          ? "bg-slate-800/80 text-cyan-400 shadow-lg shadow-black/20 ring-1 ring-slate-700/50"
          : "text-slate-400 hover:bg-slate-800/40 hover:text-slate-200",
        className
      )}
      {...props}
    >
      {isActive && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-cyan-500 rounded-l-md shadow-[0_0_10px_rgba(6,182,212,0.5)]" />
      )}
      <span className={cn(
        "flex-shrink-0 transition-colors",
        isActive ? "text-cyan-400" : "text-slate-500 group-hover/sidebar:text-slate-300"
      )}>
        {link.icon}
      </span>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{
          duration: 0.2,
          ease: "easeInOut",
        }}
        className={cn(
          "text-sm font-medium group-hover/sidebar:translate-x-1 transition duration-150 whitespace-pre",
          isActive && "text-cyan-50"
        )}
      >
        {link.label}
      </motion.span>
    </Link>
  );
};
