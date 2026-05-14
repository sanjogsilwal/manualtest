import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { setDeptLabel } from '../utils/helpers';

const ScopeContext = createContext(null);

export function ScopeProvider({ children }) {
  const [scope, setScopeState] = useState(() => ({
    department: localStorage.getItem('scope_department') || '',
    semester: localStorage.getItem('scope_semester') || ''
  }));
  const [departments, setDepartments] = useState([]);

  useEffect(() => {
    fetch('/api/admin/departments')
      .then(r => r.json())
      .then(data => {
        const depts = data.departments || [];
        setDepartments(depts);
        depts.forEach(d => setDeptLabel(d.code, d.name));
      })
      .catch(() => {});
  }, []);

  const updateDepartment = useCallback((department) => {
    localStorage.setItem('scope_department', department);
    setScopeState(s => ({ ...s, department }));
  }, []);

  const updateSemester = useCallback((semester) => {
    localStorage.setItem('scope_semester', semester);
    setScopeState(s => ({ ...s, semester }));
  }, []);

  return (
    <ScopeContext.Provider value={{ scope, departments, updateDepartment, updateSemester }}>
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope() {
  return useContext(ScopeContext);
}
