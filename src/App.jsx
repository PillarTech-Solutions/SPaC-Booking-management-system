import { useState } from 'react';
import { insertRandomRecord } from "../api/createUser.jsx";
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  const handleInsertData = async ()=> {
    try {
      await insertRandomRecord();
      console.log("Record inserted successfully!");
    } catch(e) {
      console.error(e);
    }
  }

  return (
    <>
      <div>
        <h1>Test</h1>
        <button className="p-20" onClick={handleInsertData}>Click here</button>
      </div>
    </>
  )
}

export default App
