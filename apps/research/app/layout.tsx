import type { ReactNode } from "react";
import type { Metadata } from "next";
export const metadata: Metadata={title:"Garden research workspace — not active",robots:{index:false,follow:false}};
export default function Layout({children}:{children:ReactNode}){return <html lang="en"><body style={{background:"#f7f7f3",color:"#173229",fontFamily:"system-ui",margin:0}}><a href="#main">Skip to content</a><main id="main" style={{margin:"12vh auto",padding:"2rem",maxWidth:"760px"}}>{children}</main></body></html>;}
