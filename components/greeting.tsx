"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useFirebaseAuth } from "@/lib/firebase/auth-context";

export const Greeting = () => {
  const { user } = useFirebaseAuth();

  const firstName = user?.displayName
    ? user.displayName.split(" ")[0]
    : null;

  return (
    <div
      className="mx-auto mt-4 flex size-full max-w-3xl flex-col items-start justify-center px-4 md:mt-16 md:px-8"
      key="overview"
    >
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="mb-6"
        exit={{ opacity: 0, scale: 0.95 }}
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ delay: 0.3 }}
      >
        <Image
          alt="Anthropic Agent"
          className="rounded-2xl"
          height={64}
          src="/logo.png"
          width={64}
        />
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="font-semibold text-xl md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5 }}
      >
        {firstName ? `Hello, ${firstName}!` : "Hello there!"}
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-xl text-zinc-500 md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        How can I help you today?
      </motion.div>
    </div>
  );
};
