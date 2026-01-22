using saleswaves.mn.Models;

namespace saleswaves.mn.Data;

public static class SampleData
{
    public static List<Testimonial> GetTestimonialsMn()
    {
        return new List<Testimonial>
        {
            new Testimonial
            {
                Name = "Б. Болд",
                Company = "Эрдэнэт Моторс ХХК",
                Position = "Гүйцэтгэх захирал",
                Content = "Saleswaves-тэй хамтран ажилласнаар манай компанийн импортын үйл явц маш хялбар, найдвартай болсон. Тэдний мэргэжлийн зөвлөгөө, логистикийн дэмжлэг нь үнэхээр маш сайн.",
                Rating = 5,
                Date = new DateTime(2024, 11, 1)
            },
            new Testimonial
            {
                Name = "Д. Ганбат",
                Company = "Авто Плаза ХХК",
                Position = "Худалдааны менежер",
                Content = "Япон улсаас машин авахдаа Saleswaves-ийн агент үйлчилгээ маш их тусалсан. Төлбөрийн хяналт, гаалийн бичиг баримт бүх зүйлийг шуурхай зохицуулдаг.",
                Rating = 5,
                Date = new DateTime(2024, 10, 15)
            },
            new Testimonial
            {
                Name = "С. Мөнхбат",
                Company = "Жолооч хувиараа",
                Position = "Хувиараа",
                Content = "COVID-19 цар тахлын үед ч гэсэн тэд үйл ажиллагаагаа доголдуулалгүй байсан нь надад их итгэл төрүүлсэн. Одоо 3 дахь машинаа тэднээр дамжуулж авч байна.",
                Rating = 5,
                Date = new DateTime(2024, 9, 20)
            }
        };
    }

    public static List<Testimonial> GetTestimonialsEn()
    {
        return new List<Testimonial>
        {
            new Testimonial
            {
                Name = "B. Bold",
                Company = "Erdenet Motors LLC",
                Position = "CEO",
                Content = "Working with Saleswaves has made our import process incredibly smooth and reliable. Their professional advice and logistics support are truly excellent.",
                Rating = 5,
                Date = new DateTime(2024, 11, 1)
            },
            new Testimonial
            {
                Name = "D. Ganbat",
                Company = "Auto Plaza LLC",
                Position = "Sales Manager",
                Content = "Saleswaves' agent service was extremely helpful when importing cars from Japan. They handle payment monitoring and customs documentation swiftly.",
                Rating = 5,
                Date = new DateTime(2024, 10, 15)
            },
            new Testimonial
            {
                Name = "S. Munkhbat",
                Company = "Independent Driver",
                Position = "Individual",
                Content = "Even during the COVID-19 pandemic, they maintained their operations without interruption, which gave me great confidence. I'm now purchasing my 3rd car through them.",
                Rating = 5,
                Date = new DateTime(2024, 9, 20)
            }
        };
    }

    public static List<FaqItem> GetFaqItemsMn()
    {
        return new List<FaqItem>
        {
            new FaqItem
            {
                Question = "Яаж машин захиалах вэ?",
                Answer = "Та бидэнтэй холбогдож, сонирхсон машиныхаа мэдээллийг өгнө үү. Бид танд Японы дуудлага худалдаанаас тохирох машинуудыг санал болгож, бүх зааварчилгааг өгнө.",
                Category = "Order"
            },
            new FaqItem
            {
                Question = "Машин хэдэн хоногт ирэх вэ?",
                Answer = "Япон улсаас Монгол хүртэл тээврийн хугацаа ихэвчлэн 7-14 хоног байдаг. Цаг агаар болон логистикийн нөхцөлөөс хамааран өөрчлөгдөж болно.",
                Category = "Shipping"
            },
            new FaqItem
            {
                Question = "Төлбөр яаж төлөх вэ?",
                Answer = "Бид төлбөрийн олон хувилбарыг дэмждэг: банкны шилжүүлэг, картаар төлбөр гэх мэт. Төлбөрийн нөхцөл болон аюулгүй байдлын талаар манай мэргэжилтнүүд дэлгэрэнгүй мэдээлэл өгнө.",
                Category = "Payment"
            },
            new FaqItem
            {
                Question = "Гаалийн татвар хэд вэ?",
                Answer = "Гаалийн татвар машины үнэ, он, engine багтаамжаас хамаарна. Бид таны сонирхсон машины бүх зардлын тооцооллыг урьдчилан хийж өгнө.",
                Category = "Customs"
            },
            new FaqItem
            {
                Question = "Баталгаа өгдөг үү?",
                Answer = "Тийм, бид машины чанар, гарал үүслийн баталгаа өгдөг. Японы томоохон экспорт компаниудтай ажилладаг учир машины бүх мэдээлэл бодитой, найдвартай байдаг.",
                Category = "Warranty"
            }
        };
    }

    public static List<FaqItem> GetFaqItemsEn()
    {
        return new List<FaqItem>
        {
            new FaqItem
            {
                Question = "How do I order a vehicle?",
                Answer = "Contact us with your vehicle preferences. We'll recommend suitable vehicles from Japanese auctions and provide complete guidance throughout the process.",
                Category = "Order"
            },
            new FaqItem
            {
                Question = "How long does delivery take?",
                Answer = "Shipping from Japan to Mongolia typically takes 7-14 days. This may vary depending on weather conditions and logistics factors.",
                Category = "Shipping"
            },
            new FaqItem
            {
                Question = "What payment methods do you accept?",
                Answer = "We support multiple payment options including bank transfers and card payments. Our specialists will provide detailed information about payment terms and security.",
                Category = "Payment"
            },
            new FaqItem
            {
                Question = "How much are customs duties?",
                Answer = "Customs duties depend on the vehicle's price, year, and engine capacity. We provide complete cost calculations for your selected vehicle in advance.",
                Category = "Customs"
            },
            new FaqItem
            {
                Question = "Do you provide warranty?",
                Answer = "Yes, we provide quality and origin guarantees. We work with major Japanese export companies, ensuring all vehicle information is authentic and reliable.",
                Category = "Warranty"
            }
        };
    }
}
