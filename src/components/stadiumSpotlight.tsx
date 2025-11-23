import { motion } from "framer-motion";

export default function StadiumSpotlights() {
  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none bg-neutral-950">
      {/* Spotlight 1 - Left */}
      <motion.div
        initial={{ opacity: 0.5, rotate: -15 }}
        animate={{ 
          opacity: [0.4, 0.6, 0.4],
          rotate: [-15, -5, -15],
        }}
        transition={{ 
          duration: 8, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="absolute top-[-10%] left-[-10%] w-[80%] h-[150%] bg-gradient-to-b from-white/10 via-white/5 to-transparent blur-3xl origin-top-left transform rounded-full"
        style={{ filter: "blur(60px)" }}
      />

      {/* Spotlight 2 - Right (Counter movement) */}
      <motion.div
        initial={{ opacity: 0.5, rotate: 15 }}
        animate={{ 
          opacity: [0.3, 0.5, 0.3],
          rotate: [15, 5, 15],
        }}
        transition={{ 
          duration: 10, 
          repeat: Infinity, 
          ease: "easeInOut",
          delay: 1
        }}
        className="absolute top-[-10%] right-[-10%] w-[80%] h-[150%] bg-gradient-to-b from-white/10 via-white/5 to-transparent blur-3xl origin-top-right transform rounded-full"
        style={{ filter: "blur(60px)" }}
      />

      {/* Spotlight 3 - Center Beam (Subtle) */}
      <motion.div
        animate={{ 
          opacity: [0.1, 0.3, 0.1],
          scaleX: [1, 1.2, 1]
        }}
        transition={{ 
          duration: 15, 
          repeat: Infinity, 
          ease: "easeInOut" 
        }}
        className="absolute top-[-20%] left-[20%] right-[20%] h-[120%] bg-gradient-to-b from-white/5 via-transparent to-transparent blur-2xl"
      />

      {/* Texture Overlay - Adds that 'film grain' photography look */}
      <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay"></div>
    </div>
  );
}