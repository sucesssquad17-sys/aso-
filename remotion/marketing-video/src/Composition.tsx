import {Video} from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
} from "remotion";
import {TransitionSeries, linearTiming} from "@remotion/transitions";
import {fade} from "@remotion/transitions/fade";
import {slide} from "@remotion/transitions/slide";

const COLORS = {
  ink: "#07111f",
  inkSoft: "#0d1d31",
  cyan: "#39e5d6",
  cyanSoft: "#a9fff6",
  violet: "#9c8cff",
  white: "#f5f8ff",
  muted: "#a9b8ce",
  line: "rgba(179, 208, 236, 0.2)",
};

const ease = Easing.bezier(0.16, 1, 0.3, 1);

const LogoMark = ({size = 46}: {size?: number}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.3,
      background: `linear-gradient(135deg, ${COLORS.cyan}, #3cb6ff)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 14px 34px rgba(57, 229, 214, 0.28)",
      flexShrink: 0,
    }}
  >
    <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
      <circle cx="10.8" cy="10.8" r="6.2" stroke={COLORS.ink} strokeWidth="2.8" />
      <path d="m15.5 15.5 4.4 4.4" stroke={COLORS.ink} strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  </div>
);

const Brand = () => (
  <div style={{display: "flex", alignItems: "center", gap: 16}}>
    <LogoMark />
    <div>
      <div style={{color: COLORS.white, fontSize: 27, fontWeight: 800, letterSpacing: -1.1}}>
        Rank Analyzer <span style={{color: COLORS.cyan}}>Pro</span>
      </div>
      <div style={{color: COLORS.muted, fontSize: 12, letterSpacing: 4.2, fontWeight: 700, marginTop: 6}}>
        KEYWORD INTELLIGENCE
      </div>
    </div>
  </div>
);

const Kicker = ({children, color = COLORS.cyan}: {children: React.ReactNode; color?: string}) => (
  <div style={{color, fontSize: 15, fontWeight: 800, letterSpacing: 4.6, textTransform: "uppercase"}}>
    {children}
  </div>
);

const Background = ({accent = COLORS.cyan}: {accent?: string}) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 150], [0, 34], {extrapolateRight: "clamp", easing: ease});
  const orbScale = interpolate(frame, [0, 75, 150], [1, 1.06, 1], {extrapolateRight: "clamp", easing: ease});
  return (
    <AbsoluteFill style={{overflow: "hidden", background: COLORS.ink}}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `radial-gradient(circle at 78% 18%, ${accent}22, transparent 34%), radial-gradient(circle at 12% 90%, #3172ff18, transparent 40%), linear-gradient(120deg, #07111f 0%, #0c1b2c 56%, #081322 100%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.23,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          translate: `${drift}px ${drift * -0.35}px`,
          maskImage: "linear-gradient(to bottom, black, transparent 86%)",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 600,
          height: 600,
          borderRadius: "50%",
          right: -240,
          bottom: -340,
          scale: orbScale,
          border: `1px solid ${accent}36`,
          boxShadow: `0 0 0 36px ${accent}10, 0 0 0 72px ${accent}06`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 480,
          height: 480,
          right: 150,
          top: 100,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accent}22 0%, ${accent}0 68%)`,
          filter: "blur(8px)",
          scale: orbScale,
          translate: `${drift * -0.6}px ${drift * 0.25}px`,
        }}
      />
    </AbsoluteFill>
  );
};

const Scene = ({children, duration, accent = COLORS.cyan}: {children: React.ReactNode; duration: number; accent?: string}) => {
  const frame = useCurrentFrame();
  const contentScale = interpolate(frame, [0, 22, duration - 18, duration], [1.018, 1, 1, 1.012], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease});
  const contentX = interpolate(frame, [0, duration], [12, -8], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease});
  const contentY = interpolate(frame, [0, 22, duration - 18, duration], [12, 0, 0, -10], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease});
  const sweepX = interpolate(frame, [0, duration], [-260, 2060], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease});
  return (
    <AbsoluteFill style={{overflow: "hidden"}}>
      <Background accent={accent} />
      <AbsoluteFill style={{padding: "66px 86px 58px", scale: contentScale, translate: `${contentX}px ${contentY}px`}}>{children}</AbsoluteFill>
      <div style={{position: "absolute", top: -260, bottom: -260, left: 0, width: 220, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.11), transparent)", opacity: 0.28, rotate: "18deg", translate: `${sweepX}px 0px`, mixBlendMode: "screen", pointerEvents: "none"}} />
      <div style={{position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 48%, rgba(1,7,14,0.34) 100%)", pointerEvents: "none"}} />
      <div style={{position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.72, translate: `${sweepX}px 0px`, pointerEvents: "none"}} />
    </AbsoluteFill>
  );
};

const Screen = ({
  start,
  end,
  children,
  style,
  zoom = 1.03,
  accent = COLORS.cyan,
}: {
  start: number;
  end: number;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  zoom?: number;
  accent?: string;
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const dynamicZoom = zoom + interpolate(frame, [0, 150], [0, 0.032], {extrapolateRight: "clamp", easing: ease});
  const panX = interpolate(frame, [0, 150], [0, -18], {extrapolateRight: "clamp", easing: ease});
  const sheenX = interpolate(frame, [0, 150], [-280, 1220], {extrapolateRight: "clamp", easing: ease});
  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: 28,
        border: `1px solid ${accent}66`,
        background: "#edf5fb",
        boxShadow: `0 34px 80px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.07) inset, 0 0 80px ${accent}16`,
        ...style,
      }}
    >
      <div style={{height: 44, position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "rgba(7,17,31,0.92)", borderBottom: "1px solid rgba(255,255,255,0.08)"}}>
        <span style={{width: 9, height: 9, borderRadius: "50%", background: "#ff7187"}} />
        <span style={{width: 9, height: 9, borderRadius: "50%", background: "#ffd166"}} />
        <span style={{width: 9, height: 9, borderRadius: "50%", background: COLORS.cyan}} />
        <span style={{marginLeft: 10, color: "#9eafc4", fontSize: 12, fontWeight: 700, letterSpacing: 1.5}}>RANK ANALYZER PRO / LIVE PRODUCT VIEW</span>
      </div>
      <Video
        src={staticFile("source-app.mp4")}
        trimBefore={start * fps}
        trimAfter={end * fps}
        muted
        objectFit="cover"
        style={{width: "100%", height: "calc(100% - 44px)", scale: dynamicZoom, translate: `${panX}px 0px`}}
      />
      <div style={{position: "absolute", inset: 44, background: "linear-gradient(180deg, rgba(6,14,26,0.02), rgba(6,14,26,0.18))", pointerEvents: "none"}} />
      <div style={{position: "absolute", top: 44, bottom: 0, width: 190, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)", opacity: 0.25, rotate: "14deg", translate: `${sheenX}px 0px`, mixBlendMode: "screen", pointerEvents: "none"}} />
      {children}
    </div>
  );
};

const SlideNumber = ({current}: {current: string}) => (
  <div style={{position: "absolute", bottom: 10, right: 0, color: COLORS.muted, fontSize: 13, letterSpacing: 2, fontWeight: 700}}>
    <span style={{color: COLORS.cyan}}>{current}</span> / 06
  </div>
);

const Pill = ({children, color = COLORS.cyan}: {children: React.ReactNode; color?: string}) => (
  <div style={{display: "inline-flex", alignItems: "center", gap: 10, borderRadius: 999, padding: "12px 17px", background: `${color}15`, border: `1px solid ${color}45`, color, fontSize: 13, fontWeight: 800, letterSpacing: 1.2}}>
    <span style={{width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 18px ${color}`}} />
    {children}
  </div>
);

const Metric = ({label, value, accent = COLORS.cyan}: {label: string; value: string; accent?: string}) => (
  <div style={{minWidth: 150, padding: "16px 18px", borderRadius: 18, background: "rgba(9,24,42,0.78)", border: `1px solid ${accent}3d`}}>
    <div style={{color: COLORS.muted, fontSize: 11, letterSpacing: 2.2, fontWeight: 800}}>{label}</div>
    <div style={{marginTop: 8, color: COLORS.white, fontSize: 27, fontWeight: 800, letterSpacing: -1}}>{value}</div>
  </div>
);

const Hero = () => (
  <Scene duration={150}>
    <div style={{height: "100%", display: "flex", flexDirection: "column"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <Brand />
        <Pill>APP STORE OPTIMIZATION</Pill>
      </div>
      <div style={{flex: 1, display: "flex", alignItems: "center", gap: 86}}>
        <div style={{width: 600, flexShrink: 0, display: "flex", flexDirection: "column", gap: 28}}>
          <Kicker>Signal for your next move</Kicker>
          <h1 style={{margin: 0, color: COLORS.white, fontSize: 88, lineHeight: 0.98, letterSpacing: -4.5, fontWeight: 850}}>
            Make every <span style={{color: COLORS.cyan}}>keyword</span> count.
          </h1>
          <p style={{margin: 0, color: COLORS.muted, fontSize: 27, lineHeight: 1.35, maxWidth: 560}}>
            Rank Analyzer Pro turns store data into clear, confident ASO decisions.
          </p>
          <div style={{display: "flex", alignItems: "center", gap: 14, color: COLORS.white, fontSize: 16, fontWeight: 700}}>
            <span style={{display: "inline-flex", alignItems: "center", justifyContent: "center", width: 34, height: 34, borderRadius: "50%", background: COLORS.cyan, color: COLORS.ink}}>→</span>
            Discover. Measure. Grow.
          </div>
        </div>
        <Screen start={0} end={5} style={{flex: 1, height: 590}} zoom={1.08}>
          <div style={{position: "absolute", left: 28, bottom: 26, padding: "12px 16px", borderRadius: 14, background: "rgba(7,17,31,0.82)", color: COLORS.white, fontSize: 14, fontWeight: 800, letterSpacing: 1}}>
            LIVE APP DISCOVERY
          </div>
        </Screen>
      </div>
      <SlideNumber current="01" />
    </div>
  </Scene>
);

const Discovery = () => (
  <Scene duration={150} accent="#62b9ff">
    <div style={{height: "100%", display: "flex", flexDirection: "column"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <Brand />
        <Pill color="#62b9ff">01 / DISCOVER</Pill>
      </div>
      <div style={{flex: 1, display: "flex", alignItems: "center", gap: 94}}>
        <div style={{flex: 1, display: "flex", flexDirection: "column", gap: 25}}>
          <Kicker color="#62b9ff">Start with the market</Kicker>
          <h2 style={{margin: 0, color: COLORS.white, fontSize: 70, lineHeight: 1.02, letterSpacing: -3.5, fontWeight: 850}}>
            Find demand<br /><span style={{color: "#62b9ff"}}>before</span> you build.
          </h2>
          <p style={{margin: 0, color: COLORS.muted, fontSize: 25, lineHeight: 1.4, maxWidth: 560}}>
            Search any app or store URL and see the keywords shaping its visibility.
          </p>
          <div style={{display: "flex", gap: 12, flexWrap: "wrap", marginTop: 6}}>
            <Pill color="#62b9ff">LIVE STORE DATA</Pill>
            <Pill color={COLORS.violet}>SEARCH → ANALYZE</Pill>
          </div>
        </div>
        <Screen start={5} end={11} style={{width: 950, height: 570, flexShrink: 0}} zoom={1.06} accent="#62b9ff">
          <div style={{position: "absolute", right: 24, top: 66, padding: "13px 17px", borderRadius: 15, background: "rgba(98,185,255,0.9)", color: COLORS.ink, fontSize: 15, fontWeight: 900, boxShadow: "0 12px 26px rgba(0,0,0,0.16)"}}>
            rizzmaster
          </div>
        </Screen>
      </div>
      <SlideNumber current="02" />
    </div>
  </Scene>
);

const Ranking = () => (
  <Scene duration={150} accent={COLORS.violet}>
    <div style={{height: "100%", display: "flex", flexDirection: "column"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <Brand />
        <Pill color={COLORS.violet}>02 / RANKING</Pill>
      </div>
      <div style={{flex: 1, display: "flex", alignItems: "center", gap: 92}}>
        <Screen start={11} end={17} style={{width: 1000, height: 584, flexShrink: 0}} zoom={1.04} accent={COLORS.violet}>
          <div style={{position: "absolute", left: 28, top: 72, display: "flex", gap: 10}}>
            <div style={{padding: "11px 15px", borderRadius: 14, background: "rgba(156,140,255,0.9)", color: COLORS.ink, fontSize: 13, fontWeight: 900}}>FAST</div>
            <div style={{padding: "11px 15px", borderRadius: 14, background: "rgba(7,17,31,0.85)", color: COLORS.white, fontSize: 13, fontWeight: 800}}>DEEP</div>
          </div>
        </Screen>
        <div style={{flex: 1, display: "flex", flexDirection: "column", gap: 25}}>
          <Kicker color={COLORS.violet}>Turn signals into action</Kicker>
          <h2 style={{margin: 0, color: COLORS.white, fontSize: 68, lineHeight: 1.02, letterSpacing: -3.4, fontWeight: 850}}>
            See the ranking<br /><span style={{color: COLORS.violet}}>that matters.</span>
          </h2>
          <p style={{margin: 0, color: COLORS.muted, fontSize: 25, lineHeight: 1.4}}>
            Live keyword ranking with fast scans, deep scans, and a view built for momentum.
          </p>
          <div style={{display: "flex", gap: 12, marginTop: 8}}>
            <Metric label="RANKING MODE" value="LIVE" accent={COLORS.violet} />
            <Metric label="VISIBILITY" value="TOP 100" accent={COLORS.cyan} />
          </div>
        </div>
      </div>
      <SlideNumber current="03" />
    </div>
  </Scene>
);

const GlobalTracking = () => (
  <Scene duration={150} accent="#53d9b1">
    <div style={{height: "100%", display: "flex", flexDirection: "column"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <Brand />
        <Pill color="#53d9b1">03 / GLOBAL TRACKING</Pill>
      </div>
      <div style={{flex: 1, display: "flex", alignItems: "center", gap: 90}}>
        <div style={{width: 560, flexShrink: 0, display: "flex", flexDirection: "column", gap: 24}}>
          <Kicker color="#53d9b1">One keyword, every market</Kicker>
          <h2 style={{margin: 0, color: COLORS.white, fontSize: 65, lineHeight: 1.03, letterSpacing: -3.2, fontWeight: 850}}>
            Track every market<br /><span style={{color: "#53d9b1"}}>from one view.</span>
          </h2>
          <p style={{margin: 0, color: COLORS.muted, fontSize: 25, lineHeight: 1.4}}>
            Localize your strategy with country-level visibility, all in one calm workspace.
          </p>
          <div style={{display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8}}>
            {['US', 'GB', 'AU', 'DE', 'CA'].map((country) => (
              <div key={country} style={{padding: "11px 15px", borderRadius: 13, background: "rgba(83,217,177,0.13)", border: "1px solid rgba(83,217,177,0.42)", color: "#8bf1d0", fontSize: 14, fontWeight: 900, letterSpacing: 1.3}}>{country}</div>
            ))}
          </div>
        </div>
        <Screen start={18} end={24} style={{flex: 1, height: 600}} zoom={1.04} accent="#53d9b1">
          <div style={{position: "absolute", left: 28, bottom: 25, padding: "12px 15px", borderRadius: 13, background: "rgba(7,17,31,0.86)", color: COLORS.white, fontSize: 13, fontWeight: 800, letterSpacing: 1}}>COUNTRY RANKING CONTROL</div>
        </Screen>
      </div>
      <SlideNumber current="04" />
    </div>
  </Scene>
);

const Monitoring = () => (
  <Scene duration={150} accent="#ffb86c">
    <div style={{height: "100%", display: "flex", flexDirection: "column"}}>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
        <Brand />
        <Pill color="#ffb86c">04 / MONITOR</Pill>
      </div>
      <div style={{flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28}}>
        <div style={{display: "flex", alignItems: "end", justifyContent: "space-between", gap: 60}}>
          <div style={{display: "flex", flexDirection: "column", gap: 21}}>
            <Kicker color="#ffb86c">Keep the edge</Kicker>
            <h2 style={{margin: 0, color: COLORS.white, fontSize: 72, lineHeight: 1.02, letterSpacing: -3.6, fontWeight: 850}}>
              Stay ahead of the<br /><span style={{color: "#ffb86c"}}>next move.</span>
            </h2>
          </div>
          <p style={{margin: "0 0 8px", color: COLORS.muted, fontSize: 25, lineHeight: 1.4, maxWidth: 530}}>
            Daily monitoring makes ranking movement visible before it becomes a surprise.
          </p>
        </div>
        <Screen start={28} end={35} style={{width: "100%", height: 455}} zoom={1.05} accent="#ffb86c">
          <div style={{position: "absolute", left: 30, top: 71, display: "flex", gap: 12}}>
            <Metric label="BEST" value="#1" accent="#53d9b1" />
            <Metric label="LATEST" value="#1" accent="#ffb86c" />
          </div>
        </Screen>
      </div>
      <SlideNumber current="05" />
    </div>
  </Scene>
);

const Outro = () => {
  const {fps} = useVideoConfig();
  return (
    <Scene duration={270} accent={COLORS.cyan}>
      <Video
        src={staticFile("source-app.mp4")}
        trimBefore={30 * fps}
        trimAfter={37 * fps}
        muted
        objectFit="cover"
        style={{position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.16, scale: 1.08, translate: "0px 0px"}}
      />
      <div style={{position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(7,17,31,0.98) 0%, rgba(7,17,31,0.9) 44%, rgba(7,17,31,0.62) 100%)"}} />
      <div style={{height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 28, position: "relative"}}>
        <Brand />
        <Kicker>Make the next move visible</Kicker>
        <h2 style={{margin: 0, maxWidth: 1040, color: COLORS.white, fontSize: 88, lineHeight: 0.98, letterSpacing: -4.6, fontWeight: 850}}>
          Turn visibility into <span style={{color: COLORS.cyan}}>momentum.</span>
        </h2>
        <p style={{margin: 0, color: COLORS.muted, fontSize: 28, lineHeight: 1.35}}>
          Rank Analyzer Pro for teams that ship with signal.
        </p>
        <div style={{marginTop: 8, display: "flex", alignItems: "center", gap: 16, padding: "17px 24px", borderRadius: 18, background: COLORS.cyan, color: COLORS.ink, fontSize: 18, fontWeight: 900, boxShadow: "0 18px 44px rgba(57,229,214,0.24)"}}>
          Find your next win <span style={{fontSize: 25}}>↗</span>
        </div>
      </div>
      <div style={{position: "absolute", bottom: 12, left: 0, right: 0, textAlign: "center", color: COLORS.muted, fontSize: 12, letterSpacing: 3, fontWeight: 800}}>RANK ANALYZER PRO / KEYWORD INTELLIGENCE</div>
      <SlideNumber current="06" />
    </Scene>
  );
};

export const MyComposition = () => (
  <AbsoluteFill style={{fontFamily: "Arial, Helvetica, sans-serif"}}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={150}>
        <Hero />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 12})} />
      <TransitionSeries.Sequence durationInFrames={150}>
        <Discovery />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: "from-right"})} timing={linearTiming({durationInFrames: 12})} />
      <TransitionSeries.Sequence durationInFrames={150}>
        <Ranking />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 12})} />
      <TransitionSeries.Sequence durationInFrames={150}>
        <GlobalTracking />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={slide({direction: "from-left"})} timing={linearTiming({durationInFrames: 12})} />
      <TransitionSeries.Sequence durationInFrames={150}>
        <Monitoring />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({durationInFrames: 12})} />
      <TransitionSeries.Sequence durationInFrames={270}>
        <Outro />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
