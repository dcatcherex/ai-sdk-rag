# Gemini Image Generation: How to Write Effective Prompts

**Source:** Google Blog | Gemini Products
**Published:** August 26, 2025
**Reading Time:** 6 min read
**Author:** Naina Raisinghani, Product Manager, Google DeepMind

---

## Overview

Google has launched a state-of-the-art image generation and editing model available in the Gemini app, AI Studio, and Vertex AI. This guide provides practical tips for writing effective prompts to maximize the capabilities of Gemini's latest image generation and editing features.

---

## Key Capabilities of Image Generation in Gemini

Before crafting your prompts, familiarize yourself with these core capabilities:

- **Consistent Character Design:** Preserve a character or object's appearance across multiple generations and edits.
- **Creative Composition:** Blend disparate elements, subjects, and styles from multiple concepts into a single, unified image.
- **Local Edits:** Make precise edits to specific parts of an image using simple language.
- **Design and Appearance Adaptation:** Apply a style, texture, or design from one concept to another.
- **Logic and Reasoning:** Use real-world understanding to generate complex scenes or predict the next step in a sequence.

---

## 6 Elements of Constructing Effective Prompts

You can achieve great results with simple one or two-sentence inputs. However, to unlock more nuanced creative control, include these elements:

### 1. Subject

**What it is:** Who or what is in the image? Be specific.

**Examples:**

- A stoic robot barista with glowing blue optics
- A fluffy calico cat wearing a tiny wizard hat

### 2. Composition

**What it is:** How is the shot framed?

**Examples:**

- Extreme close-up
- Wide shot
- Low angle shot
- Portrait

### 3. Action

**What it is:** What is happening?

**Examples:**

- Brewing a cup of coffee
- Casting a magical spell
- Mid-stride running through a field

### 4. Location

**What it is:** Where does the scene take place?

**Examples:**

- A futuristic cafe on Mars
- A cluttered alchemist's library
- A sun-drenched meadow at golden hour

### 5. Style

**What it is:** What is the overall aesthetic?

**Examples:**

- 3D animation
- Film noir
- Watercolor painting
- Photorealistic
- 1990s product photography

### 6. Editing Instructions

**What it is:** For modifying an existing image, be direct and specific.

**Examples:**

- Change the man's tie to green
- Remove the car in the background

---

## Prompting Examples: A Showcase of Creative Techniques

Different prompting strategies unlock various creative possibilities. Here are five proven techniques:

### Technique 1: Preserve Characters' Appearances

**How it works:** Establish a clearly defined character with specific details in your first prompt, then use follow-up prompts to place that same character in entirely new contexts.

**Example Sequence:**

**Prompt 1:**

`A whimsical illustration of a tiny, glowing mushroom sprite. The sprite has a large, 
bioluminescent mushroom cap for a hat, wide, curious eyes, and a body made of woven vines.`

**Prompt 2 (in the same conversation):**

`Now, show the same sprite riding on the back of a friendly, moss-covered snail through 
a sunny meadow full of colorful wildflowers.`

**Result:** Gemini preserves key features like facial features, distinctive appearance, and clothing across different contexts.

---

### Technique 2: Make Targeted Transformations with Precision

**How it works:** Use direct, conversational commands to modify specific elements within an image without regenerating the entire scene.

**Example Sequence:**

**Prompt 1:**

`A high-quality photo of a modern, minimalist living room with a grey sofa, a light wood 
coffee table, and a large potted plant.`

**Prompt 2 (editing):**

`Change the sofa's color to a deep navy blue.`

**Prompt 3 (editing):**

`Now, add a stack of three books to the coffee table.`

**Result:** Quick, highly precise edits perfect for product mockups or perfecting personal pictures.

---

### Technique 3: Blend Concepts with Creative Composition

**How it works:** Fuse two or more ideas into a single striking image by generating separate images and combining their subjects and environments imaginatively.

**Example Sequence:**

**Prompt 1:**

`Generate a photorealistic picture of an astronaut in a helmet and full suit.`

**Prompt 2:**

`A picture of an overgrown basketball court in the rainforest.`

**Prompt 3 (upload both and combine):**

`Show the astronaut dunking a basketball in this court.`

**Result:** Unique, composite images that merge elements from multiple concepts.

---

### Technique 4: Adapt and Apply New Styles

**How it works:** Change the mood and aesthetic of an image by applying a new style, color palette, or texture while keeping the original subject intact.

**Example Sequence:**

**Prompt 1:**

`A photorealistic image of a classic motorcycle parked on a city street.`

**Prompt 2 (editing):**

`Apply the style of an architectural drawing to this image.`

**Result:** Style transfer technology re-renders the subject entirely in the requested artistic style, useful for design inspiration and artistic exploration.

---

### Technique 5: Use Logic and Reasoning for Complex Generation

**How it works:** Provide a simple concept and let Gemini's reasoning capabilities build out the details. Useful for content requiring understanding of real-world relationships or processes.

**Example Sequence:**

**Prompt 1:**

`Generate an image of a person standing holding a 3 tiered cake.`

**Prompt 2 (in the same session):**

`Generate an image showing what would happen if they tripped.`

**Result:** The model uses logic and reasoning to predict plausible consequences, resulting in dynamic, context-aware images.

---

## Current Limitations

As the model continues to develop, these areas need improvement:

```
LimitationDetailsStylizationCan sometimes be inconsistent or produce unexpected resultsText RenderingMay occasionally misspell words or struggle with complex typographyCharacter FeaturesWhile excels at consistency, may not always preserve features reliablyAspect RatiosStruggles with maintaining aspect ratios; outputs may not support requested dimensions
```

Google is actively working to improve these areas.

---

## Key Takeaways

- Start simple: One or two-sentence prompts work well
- Add specificity for better results: Use the six elements (subject, composition, action, location, style, editing instructions)
- Leverage consistency: Establish clear characters in early prompts, then reuse them in new contexts
- Use conversational language for edits: Gemini understands natural, direct instructions
- Combine concepts: Blend multiple images and ideas for unique creations
- Expect reasoning: Let the model predict outcomes and build complex scenes based on real-world logic