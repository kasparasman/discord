import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
    return (
        <div className={styles.page}>
            <main className={styles.main}>
                <h1>Discord Bot & API Backend</h1>
                <p>
                    This repository hosts both the Discord Bot (WebSocket) and the Next.js API.
                </p>
                <div className={styles.ctas}>
                    <a className={styles.primary} href="/api/interactions">
                        Interactions Status
                    </a>
                </div>
            </main>
        </div>
    );
}
