import axiosInstance from "./axiosInstance";

export const fetchCsrfToken = async () => {
  const response = await axiosInstance.get("/api/csrf-token");
  return response.data;
};
