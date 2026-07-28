import styles from './LoadingSpinner.module.css';

export default function LoadingSpinner({ text }) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.spinner}></div>
      {text && <p className={styles.text}>{text}</p>}
    </div>
  );
}
