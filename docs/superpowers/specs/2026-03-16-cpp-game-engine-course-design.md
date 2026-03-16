# C++ Game Engine Course — Design Spec

## Overview

A 108+ chapter written course that teaches C++ from absolute zero while building a 3D game engine from scratch using DirectX 12. The course culminates in a playable first-person shooter demo.

**Target audience:** Complete beginners — never programmed before.
**Format:** Written tutorials (textbook-style blog series).
**Graphics API:** DirectX 12 — full commitment, no abstraction layers hiding it.
**Dependencies:** Minimal — math, windowing, audio, physics, file parsing all built from scratch.
**IDE:** CLion (free JetBrains educational license), CMake build system.
**Platform:** Windows-only (D3D12 requirement).

---

## Course Philosophy

### Spiral Curriculum

Every C++ concept is introduced at the moment it's needed to solve a real engine problem. No concept is taught in isolation.

**Pacing rule:** No more than 3-4 chapters of pure C++ before the learner applies it to the engine. Early chapters lean heavier on C++ basics; later chapters lean heavier on engine architecture as C++ proficiency grows.

**Spiral depth levels:**
- **First pass:** Introduce a concept simply, use it immediately (e.g., "classes hold data and functions together — here's our `Window` class")
- **Second pass:** Revisit with more depth when a harder problem demands it (e.g., inheritance and polymorphism when building the component system)
- **Third pass:** Advanced usage and optimization (e.g., move semantics and perfect forwarding when building the resource manager)

### No Tutorial Code

At no point in the course do we write "tutorial code." Every line is written as if it's going into a production codebase. When we revisit earlier code (the spiral), we refactor it to meet higher standards — and explain why.

---

## Code Quality & Engineering Principles

### Arc 1-2 (Introduced early, reinforced forever)
- **DRY** — Don't Repeat Yourself. First taught when learners notice duplicated code and we extract a function.
- **Single Responsibility** — every function does one thing, every file has one purpose.
- **Naming conventions** — descriptive names, consistent style throughout.
- **Const correctness** — if it shouldn't change, it's `const`. No exceptions.

### Arc 3-4 (As OOP is introduced)
- **SOLID principles:**
  - **S** — Single Responsibility (already introduced, now applied to classes)
  - **O** — Open/Closed (designing the renderer to be extendable without modifying base classes)
  - **L** — Liskov Substitution (when we build polymorphic render passes)
  - **I** — Interface Segregation (splitting fat interfaces when the component system grows)
  - **D** — Dependency Inversion (engine subsystems depend on abstractions, not concrete implementations)
- **Composition over inheritance** — taught as a deliberate design choice when building the entity system.

### Arc 5-6 (As complexity grows)
- **RAII everywhere** — resources are always owned. No raw `new`/`delete` outside of allocator internals.
- **Rule of Zero/Five** — every class either manages no resources or explicitly handles all five special members.
- **Error handling strategy** — no silent failures. Consistent `Result` type throughout.
- **Separation of concerns** — engine layers (platform, renderer, gameplay) have strict boundaries.

### Arc 7-10 (Advanced application)
- **Data-oriented design** — rethink class layout for cache efficiency, measured with profiling.
- **API design** — public interfaces are minimal, hard to misuse, and documented.
- **Technical debt management** — spiral revisits explicitly call out what needs improvement and why.

### Enforced throughout every chapter
- Code compiles with warnings as errors (`/W4 /WX` in MSVC).
- Every chapter's code is buildable and runnable (Ch 11 is a deliberate exception — theory-only, but includes a minimal DXGI adapter enumeration exercise).
- Comments explain **why**, never **what**.
- No magic numbers — named constants always.
- Consistent project structure from day one.

### Refactoring as a skill
Dedicated refactoring/review chapters appear at the end of every arc. These are full chapters where the learner takes working code and makes it better. The heaviest refactoring focus falls on Arcs 2, 4, 6, and 8, where significant architectural growth demands it.

---

## Chapter Template

Each chapter follows this structure:

### 1. The Problem (2-3 paragraphs)
Opens with where the engine is right now and what it can't do yet. Frames the gap as a concrete problem.

### 2. The C++ Concept (varies)
Only present when new language features are needed. Teaches the concept with a small focused example, then immediately connects it to the engine problem.

### 3. The Implementation (bulk of chapter)
Step-by-step code with every line explained on first introduction. Code is shown in full context — no "add this somewhere in the file" hand-waving. Each code listing shows the file name and what changed.

### 4. The Result
Clear description of what the learner should see when they run the build. Includes troubleshooting for common mistakes.

### 5. Exercises (2-3 per chapter)
- **Practice** — reinforce what was just taught
- **Stretch** — extend the concept
- **Challenge** — open-ended, requires independent thinking

### 6. Deep Dive (optional)
For curious learners — memory layout, compiler behavior, GPU pipeline details. Skippable without losing the thread.

### Writing rules
- No filler. Every sentence teaches or motivates.
- Code samples are complete and compilable in context.
- Design decisions explain what alternatives exist and why this one was chosen.
- When we take a simpler approach we'll improve later, say so with a specific forward reference.
- Every chapter ends connecting the current work to the bigger picture.

---

## Arc Structure

### Arc 1: First Steps (Chapters 1-10)
**Milestone:** A colored window that responds to keyboard/mouse input.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 1 | Welcome & Setup | What is C++, how code becomes an executable | Install CLion, CMake, Windows SDK. Build "Hello, World" |
| 2 | Your First Program | `main()`, `#include`, `std::cout`, compilation model | Modify the program, break it intentionally, read compiler errors |
| 3 | Variables & Types | `int`, `float`, `double`, `bool`, `char`, type sizes, `const` | Calculate screen coordinates |
| 4 | Functions | Declaration vs definition, parameters, return values, scope | Extract repeated calculations into functions. First DRY lesson |
| 5 | Control Flow | `if`/`else`, `switch`, `while`, `for`, boolean logic | Process a simple input loop in the console |
| 6 | Your First Window | Forward declarations, header files, linking | Create a Win32 window. Explain the message pump |
| 7 | The Game Loop | Separating concerns in function design | `Init()` → `Update()` → `Render()` → `Shutdown()`. Fixed vs variable timestep |
| 8 | Handling Input | Enums, bitwise operations, fixed-size arrays | Capture keyboard/mouse from Win32, store key states. Window changes color on input |
| 9 | Debugging | CLion debugger: breakpoints, watch, call stack | Intentionally introduce bugs, find them with the debugger |
| 10 | Refactor & Review | Code organization, CMake build targets | Reorganize: `src/platform/`, `src/core/`. Review against SRP |

---

### Arc 2: The Triangle (Chapters 11-20)
**Milestone:** A textured, rotating triangle rendered with D3D12.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 11 | What is a GPU? | None (conceptual) | Rendering pipeline explained: CPU vs GPU, what D3D12 does. No code |
| 12 | Pointers & Memory | Pointers, addresses, dereferencing, stack, `nullptr` | Why D3D12 needs pointers: COM objects, GPU resource handles |
| 13 | D3D12 Initialization Pt.1 | Type casting, `HRESULT` error checking | Device, Command Queue, Swap Chain. Screen clears to a solid color |
| 14 | D3D12 Initialization Pt.2 | References, `const` references | Command Allocator, Command List, RTVs, Fence. Synchronization explained |
| 15 | Structs | Defining structs, member access, passing to functions | `Vertex` struct (position, color). Build a vertex buffer. GPU memory upload |
| 16 | The Shader | String literals, file reading basics | Minimal HLSL vertex + pixel shader. Compile shaders |
| 17 | The Pipeline State | Structs of structs, designated initialization | PSO: root signature, input layout, rasterizer state. Triangle appears |
| 18 | Dynamic Memory | `new`/`delete`, heap vs stack, memory leaks | Dynamically allocate vertex data. Discuss why raw `new`/`delete` is dangerous |
| 19 | Textures | Pointer arithmetic, 2D arrays as flat memory | Load BMP manually (byte by byte), upload to GPU, map onto triangle |
| 20 | Refactor & Review | Namespace organization | Wrap D3D12 boilerplate into `Renderer` namespace. Review against DRY/SRP |

---

### Arc 3: The Math Engine (Chapters 21-30)
**Milestone:** A free-flying camera navigating 3D space with perspective projection.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 21 | Why Build Our Own Math? | Namespaces, project organization | Set up `src/math/` module |
| 22 | Vec2 & Vec3 | Classes, constructors, `this` pointer | Implement Vec2/Vec3: add, subtract, scale, length, normalize. Unit tests |
| 23 | Operator Overloading | `operator+`, `operator*`, friend functions | Make `Vec3 a + Vec3 b` work naturally |
| 24 | The Dot & Cross Products | `const` member functions, static methods | Dot product, cross product. Geometric meaning |
| 25 | Vec4 & Homogeneous Coordinates | Implicit/explicit conversions, constructor overloading | Build Vec4. Why 3D graphics needs 4 components |
| 26 | Mat4 — The Matrix | 2D arrays in classes, memory layout | Identity, multiply, transpose. What matrix transforms do geometrically |
| 27 | Transforms | Static factory methods, method chaining | Translation, Rotation, Scale. Compose transforms. Triangle moves on screen |
| 28 | Projection & View Matrices | Utility interface design | Perspective/orthographic projection. View matrix. Scene has depth |
| 29 | The Camera | Encapsulation, access modifiers, getters/setters | `Camera` class: position, Euler angles, WASD + mouse look |
| 30 | Refactor & Review | Unit testing, assertions | Audit math code for const correctness. Assertions for degenerate cases |

---

### Arc 4: The Renderer (Chapters 31-42)
**Milestone:** A lit, textured 3D scene with multiple objects and materials.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 31 | Inheritance | Base/derived, `virtual`, `override`, abstract classes | `RenderPass` base class. Why polymorphism — different pass types share an interface |
| 32 | The Mesh | `std::vector`, range-based for loops | `Mesh` class: vertex + index buffers, GPU upload, draw call. Hardcoded cube |
| 33 | Loading OBJ Files | String parsing, `std::ifstream`, `std::string` | OBJ parser from scratch. Load external 3D models |
| 34 | The Material System | Composition over inheritance | `Material` struct (diffuse, texture, shader). Multiple objects with different looks |
| 35 | Constant Buffers & Uniforms | `alignas`, padding, GPU memory rules | Per-frame, per-object, per-material constant buffers. 256-byte alignment |
| 36 | Diffuse Lighting | HLSL-focused | Lambert diffuse in pixel shader. Scene is lit |
| 37 | Specular & Ambient | HLSL-focused | Blinn-Phong specular + ambient. Lighting models discussion |
| 38 | Multiple Lights | Dynamic data arrays, GPU packing | Point light array. Scaling discussion (foreshadow deferred rendering) |
| 39 | Normal Mapping | Binary file parsing (TGA), tangent space math | TGA loader from scratch. Tangent/bitangent. Normal mapping in shader |
| 40 | The Render Graph | Dependency Inversion, interface-first design | Render pass ordering based on dependencies. Open/Closed in action |
| 41 | Shadow Mapping | Render-to-texture, depth buffers | Depth from light's perspective. Shadow acne and bias |
| 42 | Refactor & Review | API surface analysis, lightweight error conventions | Review renderer against SOLID. Clean public interfaces. Establish a consistent error handling convention (HRESULT wrapping, assert strategy, logging) — formalized into a `Result` type in Ch 105 |

---

### Arc 5: The Resource Pipeline (Chapters 43-52)
**Milestone:** Asset hot-reloading, custom binary asset formats, zero raw `new`/`delete`.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 43 | The Problem with Raw Pointers | Dangling pointers, double free, real crashes | Deliberately introduce memory bugs. Motivate ownership semantics |
| 44 | RAII | Destructors, scope-based lifetime | Wrap D3D12 COM objects in RAII wrappers |
| 45 | Smart Pointers | `unique_ptr`, `shared_ptr`, `weak_ptr`, move semantics intro | Replace every raw `new`/`delete`. Ownership graph discussion |
| 46 | Move Semantics | Lvalues/rvalues, `std::move`, move constructors | `Mesh` and `Material` movable but not copyable |
| 47 | Templates — The Basics | Function/class templates, deduction | `ResourceCache<T>` — typed cache for any asset type |
| 48 | The Resource Handle | Template specialization, opaque handles | `Handle<T>` system — lightweight IDs indexing into resource cache |
| 49 | Custom Binary Formats | Serialization, binary I/O, endianness | `.mesh`/`.mat` binary formats. Offline converter: OBJ → `.mesh` |
| 50 | The Asset Pipeline | `std::filesystem`, file watching, hashing | File watcher for source asset changes. Hot-reload into running engine |
| 51 | Perfect Forwarding & Emplacement | Forwarding references, `std::forward`, variadic templates | Optimize `ResourceCache` with in-place construction |
| 52 | Refactor & Review | Ownership audit | Map every resource: who creates, owns, destroys. Zero raw owned pointers |

---

### Arc 6: The World (Chapters 53-64)
**Milestone:** A walkable 3D level with collision detection and response.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 53 | Why Not Inheritance for Game Objects? | Diamond problem, deep hierarchy pain | Attempt inheritance for game objects. Watch it collapse. Motivate ECS |
| 54 | Entity-Component-System | Composition, data-oriented thinking | ECS design: Entity = ID, Component = data, System = logic |
| 55 | The Component Store | `std::unordered_map`, contiguous arrays, type erasure | Sparse sets for fast iteration. Cache-friendly data layouts. **Note:** This chapter may need splitting if type erasure proves too dense — consider a 55a/55b split |
| 56 | STL Containers Deep Dive | `vector`, `array`, `unordered_map`, `string` internals | Optimize component storage. Benchmark different containers |
| 57 | STL Algorithms & Iterators | `sort`, `find_if`, `transform`, lambdas | ECS query functions with lambda predicates |
| 58 | Collision Shapes | Geometric primitives | AABB, sphere, ray. Intersection tests |
| 59 | Collision Detection | Spatial partitioning, recursive structures | Spatial hash grid. Broad phase + narrow phase |
| 60 | Collision Response | Velocity, impulse resolution | Push apart, reflect velocities. Walk on floors, bump into walls |
| 61 | The Physics System | Fixed timestep, semi-implicit Euler | `PhysicsSystem` at fixed rate. Gravity. Decouple from frame rate |
| 62 | Level Geometry | Structured data loading | Simple level format. Walls, floors, platforms, spawn points |
| 63 | The Scene Graph | Trees, parent-child, recursive transforms | Hierarchical transforms. Transform propagation |
| 64 | Refactor & Review | Interface Segregation, system boundaries | Ensure systems don't reach into each other. Profile collision |

---

### Arc 7: The Player (Chapters 65-74)
**Milestone:** First-person character with movement, shooting, weapon switching, and hit detection.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 65 | The Input System | Abstraction layers, action mapping | Raw Win32 → semantic actions. Rebindable keys. Decouple gameplay from platform |
| 66 | State Machines | Enums, transition tables | Reusable `StateMachine` class. Player states, enemy AI, UI screens |
| 67 | The Player Controller | System integration, facade pattern | Input → camera → physics. Walk, sprint, jump, gravity. FPS movement |
| 68 | Raycasting | Ray-triangle intersection, spatial queries | Raycast against physics world. Foundation for shooting, interaction, AI |
| 69 | The Weapon System | Strategy pattern, polymorphism in practice | Weapon interface: `Hitscan` and `Projectile` strategies. Open/Closed |
| 70 | Projectile Physics | Object lifetime, spawn/despawn | Projectiles as entities. Physics handles movement. Collision handles impact |
| 71 | Damage & Health | Observer pattern, event systems, `std::function` | Event bus: `OnDamage`, `OnDeath`, `OnHeal`. Decoupled systems. Introduces `std::function` for type-erased callbacks |
| 72 | HUD & Debug Text | Bitmap font rendering, screen-space quads | Health, ammo, crosshair. D3D12 screen-space rendering from scratch |
| 73 | Game State Management | `std::variant`, `std::optional`, state stacks | `PlayingState`, `PausedState`, `MenuState`. Push/pop |
| 74 | Refactor & Review | Coupling audit, dependency direction | Map system dependencies. All communication via events or interfaces |

---

### Arc 8: Sound & Fury (Chapters 75-82)
**Milestone:** 3D positional audio and a particle effects system.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 75 | Digital Audio Fundamentals | Bitwise operations, PCM data | What is sound. Load WAV from scratch — parse RIFF header, extract PCM |
| 76 | WASAPI Audio Output | `std::thread`, `std::mutex` | Initialize WASAPI. Audio thread. Output sine wave. Why audio needs its own thread |
| 77 | The Audio Mixer | `std::atomic`, ring buffers, lock-free concepts | Mixer: multiple sources summed. Ring buffer for thread safety. Volume control |
| 78 | 3D Positional Audio | Distance attenuation, stereo panning | Listener-relative position. Distance falloff, L/R panning. Directional gunshots |
| 79 | The Audio System | Resource integration, streaming | `AudioSource` component + `AudioSystem`. Stream music from disk |
| 80 | Particle System — Data Design | Fixed pools, SoA vs AoS | Fixed-size pool, no gameplay allocations. SoA for cache-friendly updates |
| 81 | Particle System — Rendering | Instanced rendering, GPU buffer updates | CPU update, instanced draw calls. Muzzle flash, sparks, blood |
| 82 | Refactor & Review | Thread safety audit | Data race review. Audio thread never blocks game thread. Profile particles |

---

### Arc 9: The Enemy (Chapters 83-94)
**Milestone:** AI enemies that navigate, patrol, detect the player, and fight back.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 83 | Data Structures — Arrays & Linked Lists | Custom `DynamicArray<T>`, linked list trade-offs | Understand what `std::vector` does internally |
| 84 | Data Structures — Hash Maps | Hash functions, collision resolution, load factors | Build open-addressing hash map. Compare with `std::unordered_map` |
| 85 | Data Structures — Graphs & Trees | Adjacency lists, BFS, DFS, recursion | Graph class. Levels as graphs — rooms are nodes, doors are edges |
| 86 | Navigation Meshes | Polygon decomposition, adjacency | Generate navmesh from level geometry. Walkable convex polygons |
| 87 | A* Pathfinding | `std::priority_queue`, heuristics | A* on navmesh. Enemies find shortest paths. Debug visualization |
| 88 | Path Smoothing & Steering | Interpolation, vector projection | Smooth paths into curves. Seek, arrive, obstacle avoidance |
| 89 | Behavior Trees — Structure | Composite pattern, tree construction | `Selector`, `Sequence`, `Leaf` framework. Pure architecture |
| 90 | Behavior Trees — AI Behaviors | Lambdas, `std::function`, closures | Patrol, Chase, Attack, Flee, Investigate. Full enemy AI tree |
| 91 | Line of Sight & Perception | Cone geometry, dot product angles | Vision cone + raycast, hearing radius. Sight and sound detection |
| 92 | Enemy Combat | System integration, emergent behavior | Enemies shoot back, take damage, seek cover, die |
| 93 | Spawners & Encounter Design | Factory pattern, data-driven config | Spawn system. Enemy types/counts from level data. Test encounter |
| 94 | Refactor & Review | Big-O in practice, profiling AI | Profile pathfinding. Path caching. Review behavior tree extensibility |

---

### Arc 10: Ship It (Chapters 95-108+)
**Milestone:** A polished, playable FPS demo — complete, optimized, and distributable.

| Ch | Title | C++ Concepts | Engine Work |
|----|-------|-------------|-------------|
| 95 | Profiling — Know Before You Optimize | `std::chrono`, instrumentation | Frame profiler: time per system. Debug overlay. Never optimize without data |
| 96 | Memory Arenas | Custom allocators, placement `new`, alignment | Linear arena for per-frame temps. Zero overhead, zero fragmentation |
| 97 | Pool Allocators | Fixed-size blocks, free lists | Pool allocator for entities, components, particles |
| 98 | CPU Optimization | Cache lines, data-oriented design, branch prediction | Optimize hot loops. Measure cache misses. Before/after benchmarks |
| 99 | GPU Optimization | Draw call batching, state sorting | Sort by material, merge draws. GPU timestamps. Reduce state changes |
| 100 | Deferred Rendering | Multiple render targets, G-buffer | Replace forward with deferred. Many lights at constant cost |
| 101 | Post-Processing | Full-screen passes, ping-pong buffers | Tone mapping, gamma correction, FXAA. Professional image quality |
| 102 | Level Design & Gameplay | Data-driven design, config files | Real level: rooms, encounters, pickups, locked doors, start/end |
| 103 | Menus & UI Flow | State machine reuse | Main menu, settings, pause, death screen, victory. Full game flow |
| 104 | Save & Load | Serialization, versioning | Serialize game state. Load it back. Handle version mismatches |
| 105 | Error Handling & Robustness | `Result<T,E>`, defensive programming | `Result` type. Audit for silent failures. Graceful handling everywhere |
| 106 | Build & Package | Release builds, compiler flags, distribution | CMake release config. Package executable + assets. Distributable game |
| 107 | The Complete Picture | Architecture review | Full module dependency map. No circular dependencies. Final review |
| 108 | What's Next | Roadmap | Vulkan, PBR, skeletal animation, networking, scripting, editors |

---

## Appendices

- **A: C++ Quick Reference** — Every C++ feature taught, organized by topic, cross-referenced with chapters.
- **B: D3D12 API Reference** — Every D3D12 call used, with our usage patterns and reasoning.
- **C: HLSL Shader Reference** — All shaders collected with explanations.
- **D: Debugging & Troubleshooting** — Common problems by symptom with solutions.
- **E: CMake Reference** — Full build configuration explained.
- **F: Recommended Reading** — Books and resources for going deeper (*Game Engine Architecture*, *Real-Time Rendering*, *The C++ Programming Language*, *Effective Modern C++*, Microsoft D3D12 Programming Guide).

---

## Key Design Decisions

1. **D3D12 starts in Arc 2** after only 10 chapters of basics. Learners get a window in Arc 1 via Win32, motivating the need for a graphics API.
2. **Math library is hand-built** — no GLM. Learners understand matrix multiplies before using them.
3. **Physics is custom** — basic AABB/sphere/ray collisions, enough for an FPS, not a full rigid body sim.
4. **Audio is from scratch** — WASAPI output, manual mixing. Teaches multithreading naturally.
5. **BMP and TGA chosen over PNG** — simple enough to parse without compression libraries.
6. **OBJ for 3D models** — text-based, parseable from scratch. Binary conversion in Arc 5.
7. **ECS motivated by failure** — Arc 6 opens by attempting inheritance and watching it collapse.
8. **Refactoring chapters** at end of Arcs 2, 4, 6, 8 — enforce code quality as a first-class skill.
9. **Profiling before optimization** — Arc 10 opens with measurement, never blind optimization.
10. **Deferred rendering as validation** — the render graph from Arc 4 makes the swap possible without rewriting, proving Open/Closed works.
