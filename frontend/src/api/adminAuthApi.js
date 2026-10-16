import axiosInstance from "./axiosInstance";

export const registerCompany = async (registrationData) => {
  const response = await axiosInstance.post("/api/admin/register", registrationData);
  return response.data;
};

export const loginCompanyAdmin = async ({ phoneNumber, password }) => {
  const response = await axiosInstance.post("/api/admin/login", {
    phoneNumber,
    password,
  });
  return response.data;
};

export const logoutCompanyAdmin = async () => {
  const response = await axiosInstance.post("/api/admin/logout");
  return response.data;
};

export const getCompanyAdminProfile = async () => {
  const response = await axiosInstance.get("/api/admin/me");
  return response.data;
};