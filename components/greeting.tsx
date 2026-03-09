"use client";

import Image from "next/image";
import { useMemo, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useFirebaseAuth } from "@/lib/firebase/auth-context";
import { getTimeBasedGreeting } from "@/lib/utils";

const PROMPTS = [
  "What's on your mind?",
  "What can I help you build today?",
  "Ask me anything.",
  "Ready when you are.",
  "What are we working on?",
  "Let's figure it out together.",
  "What do you want to explore?",
  "Throw me a hard one.",
  "What shall we tackle first?",
  "I'm all yours — what's up?",
];

export const Greeting = () => {
  const { user } = useFirebaseAuth();
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  const firstName = user?.displayName
    ? user.displayName.split(" ")[0]
    : null;
  const greeting = getTimeBasedGreeting();

  const prompt = useMemo(
    () => PROMPTS[Math.floor(Math.random() * PROMPTS.length)],
    [],
  );

  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(prompt.slice(0, i));
      if (i >= prompt.length) {
        clearInterval(id);
        setDone(true);
      }
    }, 35);
    return () => clearInterval(id);
  }, [prompt]);

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
        {firstName ? `${greeting}, ${firstName}!` : `${greeting}!`}
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center text-xl text-zinc-500 md:text-2xl"
        exit={{ opacity: 0, y: 10 }}
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.6 }}
      >
        <span>{displayed}</span>
        {!done && (
          <motion.span
            animate={{ opacity: [1, 0] }}
            className="ml-0.5 inline-block h-6 w-0.5 bg-zinc-400"
            transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
          />
        )}
      </motion.div>
    </div>
  );
};
