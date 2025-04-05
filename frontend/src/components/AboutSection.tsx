'use client';

import { motion } from 'framer-motion';

const features = [
  {
    emoji: '🎲',
    title: 'Truly Random',
    description: 'Powered by VDFs, no central authority',
  },
  {
    emoji: '⏱️',
    title: 'Fair Delay',
    description: 'Randomness is tied to future blocks, no one can cheat',
  },
  {
    emoji: '🧠',
    title: 'Solve-it-Yourself',
    description: 'Users solve the puzzle to reveal results',
  },
  {
    emoji: '💰',
    title: 'Transparent Odds',
    description: 'You choose your chance to win & see the math',
  },
  {
    emoji: '😈',
    title: 'House Edge Built-In',
    description: 'Just like real casinos, but on-chain',
  },
];

export function AboutSection() {
  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-3xl font-bold text-center text-gray-900 mb-12"
        >
          What makes Seedy different?
        </motion.h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="text-4xl mb-4">{feature.emoji}</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
} 