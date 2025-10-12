// pages/index.js
export async function getServerSideProps() {
  return {
    redirect: { destination: '/tech/jobs', permanent: false }
  };
}
export default function Index() { return null; }
